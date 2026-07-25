// Built-in document templates (BlockNote blocks), available in English & French.

type Block = any;

const t = (text: string, styles: any = {}) => ({ type: "text", text, styles });
const h = (text: string, level: 1 | 2 | 3 = 2): Block => ({ type: "heading", props: { level }, content: [t(text)] });
const p = (text = ""): Block => ({ type: "paragraph", content: text ? [t(text)] : [] });
const bullet = (text: string): Block => ({ type: "bulletListItem", content: [t(text)] });
const check = (text: string): Block => ({ type: "checkListItem", props: { checked: false }, content: [t(text)] });

export type DocTemplate = {
  id: string;
  title: string;
  icon: string;
  category: string;
  description: string;
  blocks: Block[];
};

const EN: DocTemplate[] = [
  {
    id: "meeting-notes",
    title: "Meeting notes",
    icon: "📝",
    category: "Meeting",
    description: "Agenda, discussion & action items",
    blocks: [
      h("Meeting notes", 1),
      p("Date: "),
      p("Attendees: "),
      h("Agenda", 2),
      bullet("Topic 1"),
      bullet("Topic 2"),
      h("Discussion", 2),
      p(),
      h("Action items", 2),
      check("Action — owner — due"),
      check("Action — owner — due"),
      h("Decisions", 2),
      bullet("Decision 1"),
    ],
  },
  {
    id: "project-brief",
    title: "Project brief",
    icon: "📋",
    category: "Project",
    description: "Goals, scope, timeline & team",
    blocks: [
      h("Project brief", 1),
      h("Overview", 2),
      p("What is this project about?"),
      h("Goals & success metrics", 2),
      bullet("Goal 1"),
      bullet("Goal 2"),
      h("Scope", 2),
      p("In scope:"),
      bullet(""),
      p("Out of scope:"),
      bullet(""),
      h("Timeline & milestones", 2),
      bullet("Milestone — date"),
      h("Team & stakeholders", 2),
      bullet("Owner: "),
      bullet("Stakeholders: "),
    ],
  },
  {
    id: "prd",
    title: "Product requirements (PRD)",
    icon: "🚀",
    category: "Product",
    description: "Problem, requirements & metrics",
    blocks: [
      h("Product requirements document", 1),
      h("Problem statement", 2),
      p("What problem are we solving and for whom?"),
      h("Goals", 2),
      bullet("Goal 1"),
      h("Non-goals", 2),
      bullet("Non-goal 1"),
      h("User stories", 2),
      bullet("As a … I want … so that …"),
      h("Requirements", 2),
      check("Requirement 1"),
      check("Requirement 2"),
      h("Success metrics", 2),
      bullet("Metric — target"),
      h("Open questions", 2),
      bullet(""),
    ],
  },
  {
    id: "one-on-one",
    title: "1-on-1",
    icon: "🤝",
    category: "People",
    description: "Talking points, feedback & follow-ups",
    blocks: [
      h("1-on-1", 1),
      p("Date: "),
      h("How are things going?", 2),
      p(),
      h("Talking points", 2),
      bullet(""),
      h("Feedback", 2),
      p(),
      h("Action items / follow-ups", 2),
      check(""),
    ],
  },
];

const FR: DocTemplate[] = [
  {
    id: "meeting-notes",
    title: "Notes de réunion",
    icon: "📝",
    category: "Réunion",
    description: "Ordre du jour, discussion & actions",
    blocks: [
      h("Notes de réunion", 1),
      p("Date : "),
      p("Participants : "),
      h("Ordre du jour", 2),
      bullet("Sujet 1"),
      bullet("Sujet 2"),
      h("Discussion", 2),
      p(),
      h("Actions à mener", 2),
      check("Action — responsable — échéance"),
      check("Action — responsable — échéance"),
      h("Décisions", 2),
      bullet("Décision 1"),
    ],
  },
  {
    id: "project-brief",
    title: "Brief de projet",
    icon: "📋",
    category: "Projet",
    description: "Objectifs, périmètre, planning & équipe",
    blocks: [
      h("Brief de projet", 1),
      h("Vue d'ensemble", 2),
      p("De quoi parle ce projet ?"),
      h("Objectifs & indicateurs de succès", 2),
      bullet("Objectif 1"),
      bullet("Objectif 2"),
      h("Périmètre", 2),
      p("Inclus :"),
      bullet(""),
      p("Exclus :"),
      bullet(""),
      h("Planning & jalons", 2),
      bullet("Jalon — date"),
      h("Équipe & parties prenantes", 2),
      bullet("Responsable : "),
      bullet("Parties prenantes : "),
    ],
  },
  {
    id: "prd",
    title: "Spécifications produit (PRD)",
    icon: "🚀",
    category: "Produit",
    description: "Problème, exigences & métriques",
    blocks: [
      h("Document de spécifications produit", 1),
      h("Énoncé du problème", 2),
      p("Quel problème résolvons-nous et pour qui ?"),
      h("Objectifs", 2),
      bullet("Objectif 1"),
      h("Hors objectifs", 2),
      bullet("Hors objectif 1"),
      h("Scénarios utilisateurs", 2),
      bullet("En tant que … je veux … afin de …"),
      h("Exigences", 2),
      check("Exigence 1"),
      check("Exigence 2"),
      h("Indicateurs de succès", 2),
      bullet("Métrique — cible"),
      h("Questions ouvertes", 2),
      bullet(""),
    ],
  },
  {
    id: "one-on-one",
    title: "Entretien individuel",
    icon: "🤝",
    category: "Équipe",
    description: "Points à aborder, feedback & suivis",
    blocks: [
      h("Entretien individuel", 1),
      p("Date : "),
      h("Comment ça se passe ?", 2),
      p(),
      h("Points à aborder", 2),
      bullet(""),
      h("Feedback", 2),
      p(),
      h("Actions / suivis", 2),
      check(""),
    ],
  },
];

export function getBuiltinTemplates(locale: string): DocTemplate[] {
  return locale === "fr" ? FR : EN;
}
