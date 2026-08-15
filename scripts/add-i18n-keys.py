#!/usr/bin/env python3
"""Add missing i18n keys for hardcoded text to en.json and fr.json.
Only ADDS new keys; never modifies or removes existing ones.
Preserves the existing key order by inserting new keys at the end of their namespace."""
import json
import sys
from collections import OrderedDict

BASE = "apps/web/messages"

# ─── New top-level namespaces ────────────────────────────────────────────────
NEW_NAMESPACES = {
    "analytics": {
        "title": ("Analytics", "Statistiques"),
        "subtitle": ("Live overview of your workspace activity.", "Aperçu en direct de l'activité de votre espace de travail."),
        "realTime": ("Real time", "Temps réel"),
        "totalTasks": ("Total tasks", "Tâches totales"),
        "completed": ("Completed", "Terminées"),
        "documents": ("Documents", "Documents"),
        "activeProjects": ("Active projects", "Projets actifs"),
        "completionRate": ("Completion rate", "Taux d'achèvement"),
        "completionDesc": ("{rate}% of tasks completed · {inProgress} in progress", "{rate}% des tâches sont terminées · {inProgress} en cours"),
        "tasksByStatus": ("Tasks by status", "Tâches par statut"),
        "byPriority": ("By priority", "Par priorité"),
        "weeklyThroughput": ("Weekly throughput", "Débit hebdomadaire"),
        "created": ("Created", "Créées"),
        "done": ("Done", "Terminées"),
        "activity18weeks": ("Activity (last 18 weeks)", "Activité (18 dernières semaines)"),
        "less": ("Less", "Moins"),
        "more": ("More", "Plus"),
        "noData": ("No data yet", "Pas encore de données"),
        "priority": {
            "urgent": ("Urgent", "Urgente"),
            "high": ("High", "Haute"),
            "medium": ("Medium", "Moyenne"),
            "low": ("Low", "Faible"),
            "none": ("None", "Aucune"),
        },
    },
    "comments": {
        "title": ("Comments", "Commentaires"),
        "description": ("Discuss this document with your team. Mention people with @.", "Discutez de ce document avec votre équipe. Mentionnez des personnes avec @."),
        "open": ("Open", "Ouverts"),
        "resolved": ("Resolved", "Résolus"),
        "noOpen": ("No comments yet. Start the conversation.", "Pas encore de commentaires. Lancez la conversation."),
        "noResolved": ("No resolved comments.", "Aucun commentaire résolu."),
        "member": ("Member", "Membre"),
        "resolvedBadge": ("Resolved", "Résolu"),
        "reopen": ("Reopen", "Rouvrir"),
        "resolve": ("Resolve", "Résoudre"),
        "delete": ("Delete", "Supprimer"),
        "addPlaceholder": ("Add a comment… use @ to mention", "Ajoutez un commentaire… utilisez @ pour mentionner"),
        "sendTitle": ("Send (⌘/Ctrl + Enter)", "Envoyer (⌘/Ctrl + Entrée)"),
        "pressToSend": ("Press ⌘/Ctrl + Enter to send", "Appuyez sur ⌘/Ctrl + Entrée pour envoyer"),
        "postFailed": ("Could not post comment", "Impossible de publier le commentaire"),
    },
    "upgrade": {
        "title": ("Upgrade your plan", "Améliorez votre offre"),
        "limitReached": ("You've reached the {domain} limit ({used} / {limit}) on the {plan} plan.", "Vous avez atteint la limite {domain} ({used} / {limit}) sur l'offre {plan}."),
        "limitReachedUnlimited": ("You've reached the {domain} limit on the {plan} plan.", "Vous avez atteint la limite {domain} sur l'offre {plan}."),
        "upgradeDesc": ("Upgrade to a higher plan to unlock more capacity and premium features.", "Passez à une offre supérieure pour débloquer plus de capacité et des fonctionnalités premium."),
        "notNow": ("Not now", "Plus tard"),
        "viewPlans": ("View plans", "Voir les offres"),
        "domain": {
            "storageBytes": ("Storage", "Stockage"),
            "maxMembers": ("Members", "Membres"),
            "maxTasks": ("Tasks", "Tâches"),
            "maxDriveFiles": ("Drive files", "Fichiers Drive"),
            "maxEvents": ("Events", "Événements"),
            "maxContacts": ("Contacts", "Contacts"),
            "maxFileUploadBytes": ("File upload size", "Taille de fichier"),
            "maxCustomRoles": ("Custom roles", "Rôles personnalisés"),
            "maxFormsResponsesPerMonth": ("Form responses / month", "Réponses de formulaire / mois"),
        },
    },
    "core": {
        "degradedTitle": ("Shared A2E space unavailable — showing local data for this workspace.", "Espace partagé A2E indisponible — affichage des données locales de cet espace de travail."),
        "retry": ("Retry", "Réessayer"),
        "close": ("Close", "Fermer"),
    },
    "contribution": {
        "yourActivity": ("Your activity", "Votre activité"),
        "contributionsThisYear": ("{count} contribution this year", "{count} contribution cette année"),
        "contributionsThisYear_plural": ("{count} contributions this year", "{count} contributions cette année"),
        "less": ("Less", "Moins"),
        "more": ("More", "Plus"),
        "countOn": ("{count} on {date}", "{count} le {date}"),
        "weekdayMon": ("Mon", "Lun"),
        "weekdayWed": ("Wed", "Mer"),
        "weekdayFri": ("Fri", "Ven"),
    },
    "ui": {
        "close": ("Close", "Fermer"),
        "toggle": ("Toggle", "Basculer"),
        "file": ("File", "Fichier"),
        "previousMonth": ("Previous month", "Mois précédent"),
        "nextMonth": ("Next month", "Mois suivant"),
        "pickDate": ("Pick a date", "Choisir une date"),
        "commandPaletteTitle": ("Command Palette", "Palette de commandes"),
        "commandPaletteDesc": ("Search for a command to run...", "Rechercher une commande à exécuter..."),
    },
}

# ─── Keys to add to EXISTING namespaces ─────────────────────────────────────
# format: (namespace, key, value_en, value_fr)  — key may be a dotted path into nested dict
EXISTING_ADDITIONS = [
    # ── editor (document-view.tsx) ──
    ("editor", "documentNotFound", "Document not found", "Document introuvable"),
    ("editor", "documentNotFoundDesc", "It may have been deleted or moved to trash.", "Il a peut-être été supprimé ou déplacé vers la corbeille."),
    ("editor", "backToDocuments", "Back to documents", "Retour aux documents"),
    ("editor", "pageFormat", "Page format", "Format de page"),
    ("editor", "pageless", "Pageless", "Sans page"),
    ("editor", "pagelessHint", "Fluid", "Fluide"),
    ("editor", "custom", "Custom", "Personnalisé"),
    ("editor", "customHint", "Width", "Largeur"),
    ("editor", "thisDocLocked", "This document is locked", "Ce document est verrouillé"),
    ("editor", "enterPassphrase", "Enter passphrase…", "Saisir la phrase secrète…"),
    ("editor", "wrongPassphrase", "Wrong passphrase.", "Phrase secrète incorrecte."),
    ("editor", "unlocking", "Unlocking…", "Déverrouillage…"),
    ("editor", "unlock", "Unlock", "Déverrouiller"),
    ("editor", "manageLock", "Manage lock", "Gérer le verrou"),
    ("editor", "secureDocument", "Secure document", "Sécuriser le document"),
    ("editor", "lockDescLocked", "The document content is encrypted. Remove the lock or keep it secured.", "Le contenu du document est chiffré. Retirez le verrou ou conservez-le sécurisé."),
    ("editor", "lockDescUnlocked", "Content is encrypted client-side with AES-256-GCM. The passphrase never leaves your browser.", "Le contenu est chiffré côté client avec AES-256-GCM. La phrase secrète ne quitte jamais votre navigateur."),
    ("editor", "choosePassphrase", "Choose a passphrase…", "Choisir une phrase secrète…"),
    ("editor", "hintOptional", "Hint (optional, stored in plaintext)…", "Indice (facultatif, stocké en clair)…"),
    ("editor", "lockDocument", "Lock document", "Verrouiller le document"),
    ("editor", "encryptionFailed", "Encryption failed. Please try again.", "Échec du chiffrement. Veuillez réessayer."),
    ("editor", "removeLock", "Remove lock", "Retirer le verrou"),
    ("editor", "couldNotRemoveLock", "Could not remove lock.", "Impossible de retirer le verrou."),
    ("editor", "documentLocked", "Document locked", "Document verrouillé"),
    ("editor", "lockRemoved", "Lock removed", "Verrou retiré"),
    ("editor", "history", "History", "Historique"),
    ("editor", "versions", "Versions", "Versions"),
    ("editor", "activity", "Activity", "Activité"),
    ("editor", "noVersions", "No saved versions yet.", "Aucune version enregistrée pour le moment."),
    ("editor", "noVersionsHint", "Use \"Save version\" to snapshot the current state.", "Utilisez « Enregistrer la version » pour capturer l'état actuel."),
    ("editor", "restore", "Restore", "Restaurer"),
    ("editor", "versionRestored", "Version restored", "Version restaurée"),
    ("editor", "untitledFolder", "Untitled", "Sans titre"),
    ("editor", "contents", "Contents", "Contenu"),
    ("editor", "newPage", "New page", "Nouvelle page"),
    ("editor", "emptyFolder", "Empty folder", "Dossier vide"),
    ("editor", "emptyFolderDesc", "Add pages to this folder to keep them organized.", "Ajoutez des pages à ce dossier pour les organiser."),
    ("editor", "coverUpdated", "Cover updated", "Couverture mise à jour"),
    ("editor", "coverUploadFailed", "Could not upload cover", "Impossible de téléverser la couverture"),
    ("editor", "editorNotReady", "Editor not ready", "Éditeur non prêt"),
    ("editor", "exportedMarkdown", "Exported Markdown", "Markdown exporté"),
    ("editor", "exportFailed", "Export failed", "Échec de l'export"),
    ("editor", "editorLoading", "Editor is still loading", "L'éditeur est encore en cours de chargement"),
    ("editor", "savedTemplate", "Saved as template", "Enregistré comme modèle"),
    ("editor", "movedToTrash", "Moved to trash", "Déplacé vers la corbeille"),
    ("editor", "publishedShareCopied", "Published — share link copied", "Publié — lien de partage copié"),
    ("editor", "publishedToast", "Published", "Publié"),
    ("editor", "madePrivate", "Made private", "Rendu privé"),
    ("editor", "linkCopied", "Link copied", "Lien copié"),
    ("editor", "couldNotCreateDoc", "Could not create document", "Impossible de créer le document"),
    ("editor", "couldNotSaveTitle", "Could not save title", "Impossible d'enregistrer le titre"),
    ("editor", "tag", "Tag", "Étiquette"),
    ("editor", "createOrFindTag", "Create or find a tag…", "Créer ou trouver une étiquette…"),

    # ── auth (app/auth/page.tsx) ──
    ("auth", "continueGoogle", "Continue with Google", "Continuer avec Google"),
    ("auth", "or", "or", "ou"),
    ("auth", "redirecting", "Redirecting…", "Redirection…"),
    ("auth", "continueEmail", "Continue with email", "Continuer avec l'e-mail"),
    ("auth", "newToBureau", "New to Bureau? ", "Nouveau sur Bureau ? "),
    ("auth", "securedByWorkos", "Secured by WorkOS. By continuing you agree to our", "Sécurisé par WorkOS. En continuant, vous acceptez nos"),
    ("auth", "and", "and", "et"),
    ("auth", "termsLink", "Terms", "Conditions"),
    ("auth", "privacyPolicy", "Privacy Policy", "Politique de confidentialité"),
    ("auth", "signInSubtitle2", "Sign in to your connected workspace — docs, tasks & plans.", "Connectez-vous à votre espace de travail connecté — docs, tâches & plans."),
    ("auth", "signUpSubtitle2", "One calm, connected workspace for everything your team builds.", "Un espace de travail calme et connecté pour tout ce que votre équipe crée."),
    ("auth", "magicLinkHint", "You'll receive a magic link or be asked for a password — secured by WorkOS.", "Vous recevrez un lien magique ou un mot de passe vous sera demandé — sécurisé par WorkOS."),
    ("auth", "thinkTogether", "Think together,", "Penser ensemble,"),
    ("auth", "buildFaster", "build faster.", "construire plus vite."),
    ("auth", "rightPanelDesc", "Docs, tasks, calendar and databases — one durable, real-time workspace.", "Docs, tâches, calendrier et bases de données — un espace de travail durable et en temps réel."),
    ("auth", "rightDocs", "Docs", "Docs"),
    ("auth", "rightTasks", "Tasks", "Tâches"),
    ("auth", "rightCalendar", "Calendar", "Calendrier"),
    ("auth", "trustedCollaboration", "Trusted real-time collaboration", "Collaboration en temps réel fiable"),

    # ── home (app/page.tsx) ──
    ("home", "navFeatures", "Features", "Fonctionnalités"),
    ("home", "navWorkspace", "Workspace", "Espace de travail"),
    ("home", "navConnected", "Connected", "Connecté"),
    ("home", "searchOrCommand", "Search or run a command…", "Rechercher ou lancer une commande…"),
    ("home", "acmeSpace", "Acme Space", "Acme Space"),
    ("home", "navDashboard", "Dashboard", "Tableau de bord"),
    ("home", "navDocs", "Docs", "Docs"),
    ("home", "navTasks", "Tasks", "Tâches"),
    ("home", "navCalendar", "Calendar", "Calendrier"),
    ("home", "navDatabases", "Databases", "Bases de données"),
    ("home", "private", "Private", "Privé"),
    ("home", "roadmap", "📋 Roadmap", "📋 Feuille de route"),
    ("home", "okrsQ3", "🎯 OKRs Q3", "🎯 OKR T3"),
    ("home", "meetingNotes", "📝 Meeting notes", "📝 Notes de réunion"),
    ("home", "productBreadcrumb", "Product", "Produit"),
    ("home", "weeklyPlanHeading", "Weekly plan", "Plan hebdomadaire"),
    ("home", "inProgress", "In progress", "En cours"),
    ("home", "high", "High", "Haute"),
    ("home", "focusHashtag", "#focus", "#focus"),
    ("home", "calmSurface", "A single, calm surface where your notes, tasks and plans finally live together.", "Une surface unique et calme où vos notes, tâches et plans coexistent enfin."),
    ("home", "draftProductSpec", "Draft the product spec", "Rédiger la spec produit"),
    ("home", "syncDesign", "Sync with design", "Sync avec le design"),
    ("home", "shipDashboard", "Ship the new dashboard", "Livrer le nouveau tableau de bord"),
    ("home", "everythingConnected", "Everything, connected", "Tout, connecté"),
    ("home", "builtToLast", "Built to last", "Conçu pour durer"),
    ("home", "durableWorkspace", "A workspace that feels durable.", "Un espace de travail qui semble durable."),
    ("home", "durableDesc", "Strong structure, clean typography, keyboard-first flow. Write in a spacious editor, plan in colorful tables, and track everything on one calm canvas.", "Structure solide, typographie soignée, flux centré sur le clavier. Écrivez dans un éditeur spacieux, planifiez dans des tableaux colorés et suivez tout sur une toile calme."),
    ("home", "blockEditorLine", "Block editor with beautiful tables & nested pages", "Éditeur par blocs avec de beaux tableaux et pages imbriquées"),
    ("home", "mondayStyleLine", "Monday-style task tables and Kanban boards", "Tableaux de tâches style Monday et tableaux Kanban"),
    ("home", "liveAnalyticsLine", "Live analytics that update in real time", "Statistiques en direct qui se mettent à jour en temps réel"),
    ("home", "toolsUnified", "Tools unified", "Outils unifiés"),
    ("home", "collaboration", "Collaboration", "Collaboration"),
    ("home", "nestedPages", "Nested pages", "Pages imbriquées"),
    ("home", "fiveInOne", "5-in-1", "5-en-1"),
    ("home", "realTime", "Real-time", "Temps réel"),
    ("home", "infiniteNested", "∞", "∞"),
    ("home", "aiNative", "AI, natively integrated", "IA, nativement intégrée"),
    ("home", "aiDesc", "Ask, summarize and plan with context from your docs and tasks — right inside the workspace.", "Demandez, résumez et planifiez avec le contexte de vos docs et tâches — directement dans l'espace de travail."),
    ("home", "done", "Done", "Terminé"),
    ("home", "doing", "Doing", "En cours"),

    # ── calendar (calendar-view.tsx) ──
    ("calendar", "newTask", "New task", "Nouvelle tâche"),
    ("calendar", "taskTitle", "Task title…", "Titre de la tâche…"),
    ("calendar", "detachFailed", "Failed to detach occurrence", "Échec du détachement de l'occurrence"),
    ("calendar", "failed", "Failed", "Échec"),
    ("calendar", "occurrenceDeleted", "Occurrence deleted", "Occurrence supprimée"),
    ("calendar", "eventDeletedToast", "Event deleted", "Événement supprimé"),

    # ── workspace (dnd-trash-provider.tsx) ──
    ("workspace", "movedToRoot", "Moved to root", "Déplacé à la racine"),
    ("workspace", "movedToFolder", "Moved to folder", "Déplacé dans le dossier"),
    ("workspace", "couldNotMove", "Could not move document", "Impossible de déplacer le document"),
    ("workspace", "docMovedTrash", "Document moved to trash", "Document déplacé vers la corbeille"),
    ("workspace", "docMoveTrashFailed", "Could not move document to trash", "Impossible de déplacer le document vers la corbeille"),

    # ── ai (ai-assistant.tsx) ──
    ("ai", "previewChanges", "Preview changes", "Aperçu des modifications"),
    ("ai", "before", "Before", "Avant"),
    ("ai", "after", "After", "Après"),
    ("ai", "noHistory", "No history yet", "Pas encore d'historique"),
    ("ai", "pastConversations", "Past conversations will appear here", "Les conversations passées apparaîtront ici"),
    ("ai", "delete", "Delete", "Supprimer"),
]


def load(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f, object_pairs_hook=OrderedDict)


def save(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def set_nested(d, dotted_key, value):
    """Set a dotted key path like 'priority.urgent' into dict d."""
    parts = dotted_key.split(".")
    cur = d
    for p in parts[:-1]:
        if p not in cur or not isinstance(cur[p], dict):
            cur[p] = OrderedDict()
        cur = cur[p]
    cur[parts[-1]] = value


def main():
    en = load(f"{BASE}/en.json")
    fr = load(f"{BASE}/fr.json")

    added_en = 0
    added_fr = 0

    # 1. Add new top-level namespaces
    for ns, spec in NEW_NAMESPACES.items():
        if ns not in en:
            en[ns] = OrderedDict()
        if ns not in fr:
            fr[ns] = OrderedDict()
        # flatten spec: values are (en, fr) tuples, possibly nested dicts
        def walk(prefix, node):
            nonlocal added_en, added_fr
            for k, v in node.items():
                key = f"{prefix}.{k}" if prefix else k
                if isinstance(v, dict):
                    walk(key, v)
                else:
                    en_val, fr_val = v
                    if get_nested(en[ns], key) is None:
                        set_nested(en[ns], key, en_val)
                        added_en += 1
                    if get_nested(fr[ns], key) is None:
                        set_nested(fr[ns], key, fr_val)
                        added_fr += 1
        walk("", spec)

    # 2. Add keys to existing namespaces
    for ns, key, en_val, fr_val in EXISTING_ADDITIONS:
        if ns not in en:
            en[ns] = OrderedDict()
        if ns not in fr:
            fr[ns] = OrderedDict()
        if get_nested(en[ns], key) is None:
            set_nested(en[ns], key, en_val)
            added_en += 1
        if get_nested(fr[ns], key) is None:
            set_nested(fr[ns], key, fr_val)
            added_fr += 1

    save(f"{BASE}/en.json", en)
    save(f"{BASE}/fr.json", fr)
    print(f"Added {added_en} keys to en.json")
    print(f"Added {added_fr} keys to fr.json")

    # Verify parity
    def all_keys(d, prefix=""):
        keys = set()
        for k, v in d.items():
            full = f"{prefix}.{k}" if prefix else k
            if isinstance(v, dict):
                keys |= all_keys(v, full)
            else:
                keys.add(full)
        return keys
    en_keys = all_keys(en)
    fr_keys = all_keys(fr)
    diff_en = en_keys - fr_keys
    diff_fr = fr_keys - en_keys
    if diff_en:
        print(f"WARNING: {len(diff_en)} keys in EN but not FR:")
        for k in sorted(diff_en)[:10]:
            print(f"  {k}")
    if diff_fr:
        print(f"WARNING: {len(fr_keys)} keys in FR but not EN:")
        for k in sorted(diff_fr)[:10]:
            print(f"  {k}")
    if not diff_en and not diff_fr:
        print(f"✓ Parity OK — {len(en_keys)} keys in both files")


def get_nested(d, dotted_key):
    parts = dotted_key.split(".")
    cur = d
    for p in parts:
        if not isinstance(cur, dict) or p not in cur:
            return None
        cur = cur[p]
    return cur


if __name__ == "__main__":
    main()
