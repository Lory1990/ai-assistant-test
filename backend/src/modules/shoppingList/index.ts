import { prisma } from "../../db/client.js";

export interface ShoppingListItemInput {
  name: string;
  quantity?: string;
}

/** Lista della spesa condivisa dal team (aggiunte cumulative, non sovrascrive quella esistente). */
export async function addItems(teamId: string, items: ShoppingListItemInput[]) {
  if (items.length === 0) return [];
  await prisma.shoppingListItem.createMany({
    data: items.map((item) => ({ teamId, name: item.name, quantity: item.quantity })),
  });
  return listItems(teamId);
}

export async function listItems(teamId: string) {
  return prisma.shoppingListItem.findMany({
    where: { teamId },
    orderBy: [{ checked: "asc" }, { createdAt: "asc" }],
  });
}

/** Segna come acquistato il primo articolo il cui nome contiene (case-insensitive) il testo dato. */
export async function markItemChecked(teamId: string, nameQuery: string) {
  const item = await prisma.shoppingListItem.findFirst({
    where: { teamId, checked: false, name: { contains: nameQuery, mode: "insensitive" } },
  });
  if (!item) return null;
  return prisma.shoppingListItem.update({
    where: { id: item.id },
    data: { checked: true, checkedAt: new Date() },
  });
}

export async function clearCheckedItems(teamId: string) {
  return prisma.shoppingListItem.deleteMany({ where: { teamId, checked: true } });
}
