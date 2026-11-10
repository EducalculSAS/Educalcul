import { NextResponse } from "next/server";
import { generateRegistrationOptions, verifyRegistrationResponse } from "@simplewebauthn/server";
import { isoUint8Array, isoBase64URL } from "@simplewebauthn/server/helpers";
import { supabaseAdmin } from "@/lib/supabaseClient";
import { requireRole } from "@/lib/apiAuth";
import { rateLimitWithBackoff, RATE_LIMITS } from "@/lib/rateLimitAdvanced";
import { sanitizeErrorMessage, errMessage } from "@/lib/safeError";
import { getWebauthnRp } from "@/lib/webauthn";

/** Permet à un parent d'enregistrer/lister/supprimer une clé d'accès
 * (empreinte/Face ID) pour le compte de son enfant. La cérémonie WebAuthn
 * s'exécute forcément sur l'appareil qui tient ce fetch — donc à faire
 * depuis la page /parent/edit-child/[id] pendant que le parent a en main
 * l'appareil que l'enfant utilise pour se connecter. Toutes les routes
 * vérifient que l'enfant appartient bien au parent connecté (parent_id). */

async function ownedChild(parentId: number, childId: number) {
  const { data } = await supabaseAdmin
    .from("users")
    .select("id, email, child_username")
    .eq("id", childId)
    .eq("parent_id", parentId)
    .eq("role", "child")
    .maybeSingle();
  return data;
}

export async function GET(req: Request) {
  try {
    const parent = await requireRole(req, ["parent"]);
    if (!parent) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const childId = Number(new URL(req.url).searchParams.get("childId"));
    if (!childId) return NextResponse.json({ error: "childId manquant" }, { status: 400 });
    const child = await ownedChild(parent.id, childId);
    if (!child) return NextResponse.json({ error: "Enfant introuvable" }, { status: 404 });

    const { data, error } = await supabaseAdmin
      .from("webauthn_credentials")
      .select("id, device_label, created_at, last_used_at")
      .eq("user_id", child.id)
      .order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });

    return NextResponse.json({ credentials: data || [] });
  } catch (err: unknown) {
    return NextResponse.json({ error: sanitizeErrorMessage(errMessage(err)) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const parent = await requireRole(req, ["parent"]);
    if (!parent) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const config = RATE_LIMITS["webauthn:register"];
    const rl = await rateLimitWithBackoff(`webauthn:register:${parent.id}`, config.maxAttempts, config.windowMs);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Trop de demandes, réessayez dans quelques minutes." }, { status: 429 });
    }

    const body = await req.json();
    const { childId, action } = body;
    if (!childId || !action) return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
    const child = await ownedChild(parent.id, Number(childId));
    if (!child) return NextResponse.json({ error: "Enfant introuvable" }, { status: 404 });

    if (action === "options") {
      const { data: existingCreds } = await supabaseAdmin
        .from("webauthn_credentials")
        .select("credential_id")
        .eq("user_id", child.id);

      const { rpID, rpName } = getWebauthnRp(req);
      const options = await generateRegistrationOptions({
        rpName,
        rpID,
        userID: isoUint8Array.fromUTF8String(String(child.id)),
        userName: child.email || child.child_username || `enfant-${child.id}`,
        attestationType: "none",
        excludeCredentials: (existingCreds || []).map((c) => ({ id: c.credential_id })),
        authenticatorSelection: {
          residentKey: "preferred",
          userVerification: "preferred",
          authenticatorAttachment: "platform",
        },
      });

      const { error } = await supabaseAdmin
        .from("webauthn_challenges")
        .upsert({ user_id: child.id, type: "registration", challenge: options.challenge }, { onConflict: "user_id,type" });
      if (error) return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });

      return NextResponse.json(options);
    }

    if (action === "verify") {
      const { response, deviceLabel } = body;
      if (!response) return NextResponse.json({ error: "Réponse manquante" }, { status: 400 });

      const { data: pending } = await supabaseAdmin
        .from("webauthn_challenges")
        .select("challenge")
        .eq("user_id", child.id)
        .eq("type", "registration")
        .maybeSingle();
      if (!pending) return NextResponse.json({ error: "Aucune tentative d'enregistrement en cours, recommence." }, { status: 400 });

      const { rpID, origin } = getWebauthnRp(req);
      const verification = await verifyRegistrationResponse({
        response,
        expectedChallenge: pending.challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
      });
      if (!verification.verified || !verification.registrationInfo) {
        return NextResponse.json({ error: "Vérification échouée." }, { status: 400 });
      }

      const { credential } = verification.registrationInfo;
      const { error: insertError } = await supabaseAdmin.from("webauthn_credentials").insert({
        user_id: child.id,
        credential_id: credential.id,
        public_key: isoBase64URL.fromBuffer(credential.publicKey),
        counter: credential.counter,
        transports: response.response?.transports || null,
        device_label: typeof deviceLabel === "string" && deviceLabel.trim() ? deviceLabel.trim().slice(0, 60) : "Appareil",
      });
      if (insertError) return NextResponse.json({ error: sanitizeErrorMessage(insertError.message) }, { status: 500 });

      await supabaseAdmin.from("webauthn_challenges").delete().eq("user_id", child.id).eq("type", "registration");

      return NextResponse.json({ verified: true });
    }

    return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
  } catch (err: unknown) {
    console.error("[parent/child-webauthn POST] failed:", err);
    return NextResponse.json({ error: sanitizeErrorMessage(errMessage(err)) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const parent = await requireRole(req, ["parent"]);
    if (!parent) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { childId, credentialId } = await req.json();
    if (!childId || !credentialId) return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
    const child = await ownedChild(parent.id, Number(childId));
    if (!child) return NextResponse.json({ error: "Enfant introuvable" }, { status: 404 });

    const { error } = await supabaseAdmin
      .from("webauthn_credentials")
      .delete()
      .eq("id", credentialId)
      .eq("user_id", child.id);
    if (error) return NextResponse.json({ error: sanitizeErrorMessage(error.message) }, { status: 500 });

    return NextResponse.json({ deleted: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: sanitizeErrorMessage(errMessage(err)) }, { status: 500 });
  }
}
