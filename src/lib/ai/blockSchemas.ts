


export type JsonSchema = Record<string, unknown>;


export const noExtra = { additionalProperties: false } as const;


export const textPart: JsonSchema = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["text"] },
    value: { type: "string", minLength: 1 },
  },
  required: ["type", "value"],
  ...noExtra,
};


export const mathPart: JsonSchema = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["math"] },
    latex: { type: "string", minLength: 1 },
  },
  required: ["type", "latex"],
  ...noExtra,
};


export const structuredRichTextObject: JsonSchema = {
  type: "object",
  properties: {
    parts: {
      type: "array",
      minItems: 1,
      maxItems: 30,
      items: { oneOf: [textPart, mathPart] },
    },
  },
  required: ["parts"],
  ...noExtra,
};


// Les générateurs récents peuvent écrire les champs enrichis sous forme de
// chaînes Markdown avec mathématiques délimitées par $...$ ou $$...$$. Le
// normaliseur les transforme ensuite localement en parts text/math. On garde
// l'ancien objet parts pour compatibilité avec les exercices et quiz existants.
export const richText: JsonSchema = {
  oneOf: [
    { type: "string", minLength: 1 },
    structuredRichTextObject,
  ],
};


export const optionalRichText: JsonSchema = {
  oneOf: [
    { type: "string" },
    {
      type: "object",
      properties: {
        parts: {
          type: "array",
          minItems: 0,
          maxItems: 30,
          items: { oneOf: [textPart, mathPart] },
        },
      },
      required: ["parts"],
      ...noExtra,
    },
  ],
};


export const paragraphBlock: JsonSchema = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["paragraph"] },
    content: richText,
  },
  required: ["type", "content"],
  ...noExtra,
};


export const displayMathBlock: JsonSchema = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["display_math"] },
    latex: { type: "string", minLength: 1 },
  },
  required: ["type", "latex"],
  ...noExtra,
};


export const listBlock: JsonSchema = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["list"] },
    ordered: { type: "boolean" },
    items: {
      type: "array",
      minItems: 1,
      maxItems: 14,
      items: richText,
    },
  },
  required: ["type", "ordered", "items"],
  ...noExtra,
};


export const calloutBlock: JsonSchema = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["callout"] },
    variant: { type: "string", enum: ["note", "warning"] },
    title: richText,
    paragraphs: {
      type: "array",
      minItems: 1,
      maxItems: 5,
      items: richText,
    },
  },
  required: ["type", "variant", "title", "paragraphs"],
  ...noExtra,
};


export const tableBlock: JsonSchema = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["table"] },
    variant: { type: "string", enum: ["value"] },
    headers: {
      type: "array",
      minItems: 1,
      maxItems: 8,
      items: richText,
    },
    rows: {
      type: "array",
      minItems: 1,
      maxItems: 20,
      items: {
        type: "array",
        minItems: 1,
        maxItems: 8,
        items: richText,
      },
    },
  },
  required: ["type", "variant", "headers", "rows"],
  ...noExtra,
};


export const columnOperationBlock: JsonSchema = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["column_operation"] },
    operator: { type: "string", enum: ["+", "-", "×", "÷"] },
    operands: {
      type: "array",
      minItems: 2,
      maxItems: 4,
      items: { type: "string" },
    },
    result: { type: "string" },
    carries: {
      type: "array",
      maxItems: 12,
      items: { type: "string" },
    },
  },
  required: ["type", "operator", "operands", "result", "carries"],
  ...noExtra,
};


export const imageBlock: JsonSchema = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["image"] },
    query: { type: "string", minLength: 1, maxLength: 200 },
    caption: { type: "string", maxLength: 200 },
  },
  required: ["type", "query", "caption"],
  ...noExtra,
};


export const baseTenBlocksBlock: JsonSchema = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["base_ten_blocks"] },
    hundreds: { type: "integer", minimum: 0, maximum: 9 },
    tens: { type: "integer", minimum: 0, maximum: 9 },
    units: { type: "integer", minimum: 0, maximum: 9 },
    caption: { type: "string", maxLength: 200 },
  },
  required: ["type", "hundreds", "tens", "units", "caption"],
  ...noExtra,
};


export const signValueSchema: JsonSchema = {
  type: "string",
  enum: ["negative", "zero", "positive", "undefined"],
};


export const signTableBlock: JsonSchema = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["sign_table"] },
    expression: richText,
    boundaries: {
      type: "array",
      minItems: 1,
      maxItems: 6,
      items: richText,
    },
    interval_signs: {
      type: "array",
      minItems: 2,
      maxItems: 7,
      items: signValueSchema,
    },
    boundary_signs: {
      type: "array",
      minItems: 1,
      maxItems: 6,
      items: signValueSchema,
    },
  },
  required: [
    "type",
    "expression",
    "boundaries",
    "interval_signs",
    "boundary_signs",
  ],
  ...noExtra,
};


export const variationTableBlock: JsonSchema = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["variation_table"] },
    variable: richText,
    function_name: richText,
    points: {
      type: "array",
      minItems: 2,
      maxItems: 7,
      items: richText,
    },
    values: {
      type: "array",
      minItems: 2,
      maxItems: 7,
      items: richText,
    },
    directions: {
      type: "array",
      minItems: 1,
      maxItems: 6,
      items: { type: "string", enum: ["up", "down", "constant"] },
    },
    derivative_signs: {
      type: "array",
      minItems: 1,
      maxItems: 6,
      items: signValueSchema,
    },
  },
  required: [
    "type",
    "variable",
    "function_name",
    "points",
    "values",
    "directions",
    "derivative_signs",
  ],
  ...noExtra,
};


export const graphVector: JsonSchema = {
  type: "object",
  properties: {
    x: { type: "number", minimum: -100, maximum: 100 },
    y: { type: "number", minimum: -100, maximum: 100 },
    from_x: { type: "number", minimum: -100, maximum: 100 },
    from_y: { type: "number", minimum: -100, maximum: 100 },
    label: { type: "string", maxLength: 20 },
    tone: {
      type: "string",
      enum: ["navy", "gold", "blue", "green", "red", "gray"],
    },
  },
  required: ["x", "y", "from_x", "from_y", "label", "tone"],
  ...noExtra,
};


export const graphBlock: JsonSchema = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["graph"] },
    expression: { type: "string", minLength: 1, maxLength: 180 },
    xmin: { type: "number" },
    xmax: { type: "number" },
    caption: { type: "string", minLength: 1, maxLength: 300 },
    parameter: {
      oneOf: [
        { type: "null" },
        {
          type: "object",
          properties: {
            name: { type: "string", minLength: 1, maxLength: 2 },
            min: { type: "number" },
            max: { type: "number" },
            default: { type: "number" },
          },
          required: ["name", "min", "max", "default"],
          ...noExtra,
        },
      ],
    },
    vectors: {
      type: "array",
      minItems: 0,
      maxItems: 5,
      items: graphVector,
    },
  },
  required: [
    "type",
    "expression",
    "xmin",
    "xmax",
    "caption",
    "parameter",
    "vectors",
  ],
  ...noExtra,
};


export const figureTone: JsonSchema = {
  type: "string",
  enum: ["navy", "gold", "blue", "green", "red", "gray"],
};


export const figureLabelProperties = {
  tone: figureTone,
  label: optionalRichText,
  label_x: { type: "number", minimum: 0, maximum: 200 },
  label_y: { type: "number", minimum: 0, maximum: 160 },
};


export const figureLine: JsonSchema = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["line"] },
    x1: { type: "number", minimum: 0, maximum: 200 },
    y1: { type: "number", minimum: 0, maximum: 160 },
    x2: { type: "number", minimum: 0, maximum: 200 },
    y2: { type: "number", minimum: 0, maximum: 160 },
    dashed: { type: "boolean" },
    arrow_end: { type: "boolean" },
    ...figureLabelProperties,
  },
  required: [
    "type",
    "x1",
    "y1",
    "x2",
    "y2",
    "dashed",
    "arrow_end",
    "tone",
    "label",
    "label_x",
    "label_y",
  ],
  ...noExtra,
};


export const figurePoint: JsonSchema = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["point"] },
    x: { type: "number", minimum: 0, maximum: 200 },
    y: { type: "number", minimum: 0, maximum: 160 },
    ...figureLabelProperties,
  },
  required: ["type", "x", "y", "tone", "label", "label_x", "label_y"],
  ...noExtra,
};


export const figureCircle: JsonSchema = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["circle"] },
    cx: { type: "number", minimum: 0, maximum: 200 },
    cy: { type: "number", minimum: 0, maximum: 160 },
    r: { type: "number", minimum: 2, maximum: 80 },
    filled: { type: "boolean" },
    ...figureLabelProperties,
  },
  required: [
    "type",
    "cx",
    "cy",
    "r",
    "filled",
    "tone",
    "label",
    "label_x",
    "label_y",
  ],
  ...noExtra,
};


export const figurePolygon: JsonSchema = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["polygon"] },
    points: {
      type: "array",
      minItems: 3,
      maxItems: 8,
      items: {
        type: "object",
        properties: {
          x: { type: "number", minimum: 0, maximum: 200 },
          y: { type: "number", minimum: 0, maximum: 160 },
        },
        required: ["x", "y"],
        ...noExtra,
      },
    },
    filled: { type: "boolean" },
    ...figureLabelProperties,
  },
  required: [
    "type",
    "points",
    "filled",
    "tone",
    "label",
    "label_x",
    "label_y",
  ],
  ...noExtra,
};


export const figureArc: JsonSchema = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["arc"] },
    cx: { type: "number", minimum: 0, maximum: 200 },
    cy: { type: "number", minimum: 0, maximum: 160 },
    r: { type: "number", minimum: 2, maximum: 80 },
    start_angle: { type: "number", minimum: -360, maximum: 360 },
    end_angle: { type: "number", minimum: -360, maximum: 360 },
    ...figureLabelProperties,
  },
  required: [
    "type",
    "cx",
    "cy",
    "r",
    "start_angle",
    "end_angle",
    "tone",
    "label",
    "label_x",
    "label_y",
  ],
  ...noExtra,
};


export const figureBlock: JsonSchema = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["figure"] },
    caption: { type: "string", minLength: 1, maxLength: 300 },
    elements: {
      type: "array",
      minItems: 1,
      maxItems: 12,
      items: {
        oneOf: [
          figureLine,
          figurePoint,
          figureCircle,
          figurePolygon,
          figureArc,
        ],
      },
    },
  },
  required: ["type", "caption", "elements"],
  ...noExtra,
};


export const toneEnum: JsonSchema = {
  type: "string",
  enum: ["navy", "gold", "blue", "green", "red", "gray"],
};


// Diagrammes déterministes : seules des données sémantiques sont demandées
// (angles, valeurs, labels courts) — jamais de coordonnées pixel choisies par
// le modèle. compiler.ts calcule la disposition géométrique exacte, ce qui
// élimine la classe de bugs de "figure" (chevauchement, débordement du
// viewBox, labels mathématiques illisibles en <text> SVG brut).

export const trigCircleBlock: JsonSchema = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["trig_circle"] },
    caption: { type: "string", minLength: 1, maxLength: 300 },
    highlighted_angles: {
      type: "array",
      minItems: 0,
      maxItems: 16,
      items: {
        type: "object",
        properties: {
          angle_deg: { type: "number", minimum: -360, maximum: 360 },
          label: { type: "string", minLength: 1, maxLength: 24 },
        },
        required: ["angle_deg", "label"],
        ...noExtra,
      },
    },
  },
  required: ["type", "caption", "highlighted_angles"],
  ...noExtra,
};


export const pieChartBlock: JsonSchema = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["pie_chart"] },
    caption: { type: "string", minLength: 1, maxLength: 300 },
    slices: {
      type: "array",
      minItems: 2,
      maxItems: 8,
      items: {
        type: "object",
        properties: {
          label: { type: "string", minLength: 1, maxLength: 60 },
          value: { type: "number", minimum: 0 },
          tone: toneEnum,
        },
        required: ["label", "value", "tone"],
        ...noExtra,
      },
    },
  },
  required: ["type", "caption", "slices"],
  ...noExtra,
};


export const numberLineBlock: JsonSchema = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["number_line"] },
    caption: { type: "string", minLength: 1, maxLength: 300 },
    min: { type: "number" },
    max: { type: "number" },
    points: {
      type: "array",
      minItems: 0,
      maxItems: 8,
      items: {
        type: "object",
        properties: {
          value: { type: "number" },
          label: { type: "string", minLength: 1, maxLength: 40 },
          filled: { type: "boolean" },
        },
        required: ["value", "label", "filled"],
        ...noExtra,
      },
    },
    intervals: {
      type: "array",
      minItems: 0,
      maxItems: 4,
      items: {
        type: "object",
        properties: {
          from: { type: "number" },
          to: { type: "number" },
          from_included: { type: "boolean" },
          to_included: { type: "boolean" },
          tone: toneEnum,
        },
        required: ["from", "to", "from_included", "to_included", "tone"],
        ...noExtra,
      },
    },
  },
  required: ["type", "caption", "min", "max", "points", "intervals"],
  ...noExtra,
};


export const barChartBlock: JsonSchema = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["bar_chart"] },
    caption: { type: "string", minLength: 1, maxLength: 300 },
    bars: {
      type: "array",
      minItems: 2,
      maxItems: 10,
      items: {
        type: "object",
        properties: {
          label: { type: "string", minLength: 1, maxLength: 30 },
          value: { type: "number", minimum: 0 },
          tone: toneEnum,
        },
        required: ["label", "value", "tone"],
        ...noExtra,
      },
    },
  },
  required: ["type", "caption", "bars"],
  ...noExtra,
};


export const probabilityLeaf: JsonSchema = {
  type: "object",
  properties: {
    label: { type: "string", minLength: 1, maxLength: 40 },
    probability: { type: "string", minLength: 1, maxLength: 20 },
  },
  required: ["label", "probability"],
  ...noExtra,
};


export const probabilityTreeBlock: JsonSchema = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["probability_tree"] },
    caption: { type: "string", minLength: 1, maxLength: 300 },
    branches: {
      type: "array",
      minItems: 2,
      maxItems: 4,
      items: {
        type: "object",
        properties: {
          label: { type: "string", minLength: 1, maxLength: 40 },
          probability: { type: "string", minLength: 1, maxLength: 20 },
          children: {
            type: "array",
            minItems: 0,
            maxItems: 4,
            items: probabilityLeaf,
          },
        },
        required: ["label", "probability", "children"],
        ...noExtra,
      },
    },
  },
  required: ["type", "caption", "branches"],
  ...noExtra,
};


export const vennDiagramBlock: JsonSchema = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["venn_diagram"] },
    caption: { type: "string", minLength: 1, maxLength: 300 },
    sets: {
      type: "array",
      minItems: 2,
      maxItems: 3,
      items: {
        type: "object",
        properties: {
          label: { type: "string", minLength: 1, maxLength: 30 },
          tone: toneEnum,
        },
        required: ["label", "tone"],
        ...noExtra,
      },
    },
    region_labels: {
      oneOf: [
        { type: "null" },
        {
          type: "object",
          properties: {
            a_only: { type: "string", maxLength: 30 },
            b_only: { type: "string", maxLength: 30 },
            both: { type: "string", maxLength: 30 },
            neither: { type: "string", maxLength: 30 },
          },
          required: ["a_only", "b_only", "both", "neither"],
          ...noExtra,
        },
      ],
    },
  },
  required: ["type", "caption", "sets", "region_labels"],
  ...noExtra,
};


export const shapePartSchema: JsonSchema = {
  type: "object",
  properties: {
    kind: {
      type: "string",
      enum: [
        "rectangle",
        "square",
        "right_triangle",
        "triangle",
        "polygon",
        "circle",
        "arc",
        "angle",
        "segment",
        "line",
        "point",
        "text",
      ],
    },
    text: { type: "string", maxLength: 24 },
    x: { type: "number" },
    y: { type: "number" },
    w: { type: "number" },
    h: { type: "number" },
    r: { type: "number" },
    start_angle: { type: "number" },
    end_angle: { type: "number" },
    points: {
      type: "array",
      maxItems: 12,
      items: {
        type: "object",
        properties: { x: { type: "number" }, y: { type: "number" } },
        required: ["x", "y"],
        ...noExtra,
      },
    },
    tone: { type: "string", enum: ["navy", "gold", "blue", "green", "red", "gray"] },
    filled: { type: "boolean" },
    dashed: { type: "boolean" },
    arrow: { type: "string", enum: ["none", "end", "both"] },
    vertex_labels: { type: "array", maxItems: 12, items: { type: "string", maxLength: 18 } },
    side_labels: { type: "array", maxItems: 12, items: { type: "string", maxLength: 18 } },
    right_angle_at: {
      oneOf: [{ type: "null" }, { type: "integer", minimum: 0, maximum: 11 }],
    },
    show_dimensions: { type: "boolean" },
  },
  required: [
    "kind",
    "text",
    "x",
    "y",
    "w",
    "h",
    "r",
    "start_angle",
    "end_angle",
    "points",
    "tone",
    "filled",
    "dashed",
    "arrow",
    "vertex_labels",
    "side_labels",
    "right_angle_at",
    "show_dimensions",
  ],
  ...noExtra,
};


export const shapeBlock: JsonSchema = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["shape"] },
    caption: { type: "string", minLength: 1, maxLength: 300 },
    width: { type: "integer", minimum: 4, maximum: 40 },
    height: { type: "integer", minimum: 4, maximum: 34 },
    preset: { type: "string", enum: ["none", "pythagoras"] },
    a: { type: "number", minimum: 1, maximum: 12 },
    b: { type: "number", minimum: 1, maximum: 12 },
    parts: { type: "array", minItems: 0, maxItems: 8, items: shapePartSchema },
  },
  required: ["type", "caption", "width", "height", "preset", "a", "b", "parts"],
  ...noExtra,
};


export const boxPlotBlock: JsonSchema = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["box_plot"] },
    caption: { type: "string", minLength: 1, maxLength: 300 },
    min: { type: "number" },
    q1: { type: "number" },
    median: { type: "number" },
    q3: { type: "number" },
    max: { type: "number" },
    axis_label: { oneOf: [{ type: "null" }, { type: "string", maxLength: 40 }] },
  },
  required: ["type", "caption", "min", "q1", "median", "q3", "max", "axis_label"],
  ...noExtra,
};


export const exerciseRefBlock: JsonSchema = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["exercise"] },
    exercise_index: { type: "integer", minimum: 1, maximum: 8 },
  },
  required: ["type", "exercise_index"],
  ...noExtra,
};


export const simpleStepBlock: JsonSchema = {
  oneOf: [paragraphBlock, displayMathBlock, listBlock, calloutBlock],
};


export const stepsBlock: JsonSchema = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["steps"] },
    steps: {
      type: "array",
      minItems: 2,
      maxItems: 8,
      items: {
        type: "object",
        properties: {
          title: richText,
          blocks: {
            type: "array",
            minItems: 1,
            maxItems: 8,
            items: simpleStepBlock,
          },
        },
        required: ["title", "blocks"],
        ...noExtra,
      },
    },
  },
  required: ["type", "steps"],
  ...noExtra,
};


export const headingBlock: JsonSchema = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["heading"] },
    level: { type: "integer", enum: [3, 4] },
    content: richText,
  },
  required: ["type", "level", "content"],
  ...noExtra,
};


export const courseBlock: JsonSchema = {
  oneOf: [
    headingBlock,
    paragraphBlock,
    displayMathBlock,
    listBlock,
    calloutBlock,
    tableBlock,
    columnOperationBlock,
    imageBlock,
    baseTenBlocksBlock,
    signTableBlock,
    variationTableBlock,
    graphBlock,
    figureBlock,
    trigCircleBlock,
    pieChartBlock,
    numberLineBlock,
    barChartBlock,
    probabilityTreeBlock,
    vennDiagramBlock,
    shapeBlock,
    boxPlotBlock,
    exerciseRefBlock,
    stepsBlock,
  ],
};


export const courseExercise: JsonSchema = {
  type: "object",
  properties: {
    question: richText,
    answer: richText,
    hint: richText,
    explanation: richText,
  },
  required: ["question", "answer", "hint", "explanation"],
  ...noExtra,
};
