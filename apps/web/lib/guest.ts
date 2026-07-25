// Anonymous guest identity for public share pages.
// Stable per-browser via localStorage; fun readable names, locale-aware.

const ANIMALS_EN = ["Fox", "Owl", "Panda", "Otter", "Lynx", "Heron", "Koala", "Dolphin", "Falcon", "Badger", "Tiger", "Rabbit"];
const ANIMALS_FR = ["Renard", "Hibou", "Panda", "Loutre", "Lynx", "Héron", "Koala", "Dauphin", "Faucon", "Blaireau", "Tigre", "Lapin"];

const ID_KEY = "flux-guest-id";
const NAME_KEY = "flux-guest-name";

export type GuestIdentity = { id: string; name: string };

export function getGuestIdentity(locale: string): GuestIdentity {
  if (typeof window === "undefined") return { id: "ssr", name: "Guest" };
  let id = localStorage.getItem(ID_KEY);
  if (!id) {
    id = (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)).slice(0, 32);
    localStorage.setItem(ID_KEY, id);
  }
  let name = localStorage.getItem(NAME_KEY);
  if (!name) {
    const animals = locale === "fr" ? ANIMALS_FR : ANIMALS_EN;
    const animal = animals[Math.floor(Math.random() * animals.length)];
    name = locale === "fr" ? `Invité ${animal}` : `Guest ${animal}`;
    localStorage.setItem(NAME_KEY, name);
  }
  return { id, name };
}

export function setGuestName(name: string): string {
  const clean = name.trim().slice(0, 40) || "Guest";
  if (typeof window !== "undefined") localStorage.setItem(NAME_KEY, clean);
  return clean;
}
