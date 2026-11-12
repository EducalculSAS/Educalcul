/**
 * Mode d'emploi d'EduFig pour un modèle de langage : court, avec des exemples justes. La figure se décrit par ce
 * qu'elle représente ; le moteur calcule les positions (à l'échelle) et refuse un triangle impossible.
 */
export const EDUFIG_PROMPT_GUIDE = `FIGURES (ressource "edufig") : pour toute figure géométrique, statistique ou de probabilités, utilise une ressource {"type":"edufig","fig_json":"<JSON>"} où <JSON> décrit la figure par ses DONNÉES, jamais par des coordonnées à l'écran. Le moteur dessine à l'échelle et vérifie la cohérence avec l'énoncé : les longueurs, l'angle droit et les parallèles écrits dans l'énoncé doivent être exactement ceux de la figure.
Types (champ "kind") et exemples :
• Triangle rectangle : {"kind":"geometry","unit":"cm","steps":[{"op":"triangle","names":["A","B","C"],"right":"B","lengths":{"AB":5,"BC":12}}],"items":[{"type":"segment","from":"A","to":"B","label":true},{"type":"segment","from":"B","to":"C","label":true},{"type":"segment","from":"A","to":"C","label":"?"}]}
• Triangle quelconque : "lengths" avec les trois côtés, ou deux côtés + "angles":{"A":40}. label:true écrit la longueur calculée, label:"?" marque l'inconnue. Pour une réciproque de Pythagore, ne mets PAS "right" (l'élève doit le démontrer).
• Thalès : {"kind":"geometry","unit":"cm","steps":[{"op":"thales","names":["A","B","C","M","N"],"AB":6,"AC":7.5,"BC":5,"AM":2.4}],"items":[{"type":"segment","from":"A","to":"M","label":true},{"type":"segment","from":"M","to":"N","label":"?"}]} ; "butterfly":true pour la configuration papillon.
• Trigonométrie : triangle avec "right" + un côté + "angles":{"A":35}, et {"type":"angle","points":["C","A","B"],"label":"35°"}.
• Quadrilatères : {"op":"rectangle","names":["A","B","C","D"],"width":8,"height":5}, "square" (side), "parallelogram" (base, side, angle), "rhombus" (side, angle), "trapezoid" (base, top, height). Cercle : {"op":"circle","center":"O","radius":3}.
• Autres constructions : {"op":"point","name":"A","x":1,"y":2}, {"op":"midpoint","name":"I","of":["A","B"]}, {"op":"onSegment","name":"M","from":"A","to":"B","distance":2}, {"op":"foot","name":"H","from":"A","line":["B","C"]}, {"op":"image","map":{"A":"A'","B":"B'","C":"C'"},"transform":{"type":"symmetryLine","line":["P","Q"]}} (aussi symmetryPoint+center, rotation+center+angle, translation+from+to, homothety+center+k).
• Éléments ("items") : segment, line, ray, vector, circle, polygon, angle (points [A,B,C] = angle ABC, label), right (codage d'angle droit), equal (codage de longueurs égales), points, text.
• Repère : {"kind":"graph","x":[-4,4],"curves":[{"expr":"2x - 1","name":"f"}],"points":[{"x":2,"y":3,"name":"A","guides":true}]}
• Droite graduée : {"kind":"numberline","min":-3,"max":5,"step":1,"points":[{"value":1.5,"name":"A"}],"intervals":[{"from":-1,"to":5,"closedFrom":true,"closedTo":false}]}
• Statistiques : {"kind":"bar","categories":["A","B"],"values":[12,8],"yLabel":"Effectif"} (histogramme : "joined":true), {"kind":"pie","items":[{"label":"Bus","value":10}]}, {"kind":"linechart","labels":["2022","2023"],"series":[{"values":[3,5]}]}
• Probabilités : {"kind":"tree","branches":[{"label":"R","p":"3/5","children":[{"label":"R","p":"2/4"},{"label":"B","p":"2/4"}]},{"label":"B","p":"2/5"}]}
• Solides : {"kind":"solid","shape":"box","dims":{"a":5,"b":3,"c":4}} (cube a ; cylinder/cone r,h ; pyramid a,h ; sphere r ; prism a,h,b).
• Programme de calcul : {"kind":"program","steps":["Choisir un nombre","Multiplier par 3","Ajouter 5"]}
Les nombres de la figure sont ceux de l'énoncé. Une courbe de fonction utilise graph ou edufig "graph", jamais une figure libre.`;
