import InscriptionClient from "./InscriptionClient";
import InscriptionInfo from "./InscriptionInfo";

export default function InscriptionPage() {
  return (
    <div className="w-full max-w-md flex flex-col items-center gap-8">
      <InscriptionClient />
      <InscriptionInfo />
    </div>
  );
}
