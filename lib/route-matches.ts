import { collection, doc, onSnapshot, runTransaction, serverTimestamp, type DocumentData, type FirestoreError, type Timestamp, type Unsubscribe } from "firebase/firestore";
import { firestore } from "@/lib/firebase";
import { stageOrderAcceptance } from "@/lib/orders";
import type { CarrierProfile, RankedRouteMatch, RouteMatch } from "@/types/cargo";

function requireFirestore() {
  if (!firestore) throw new Error("Firebase не настроен.");
  return firestore;
}

function toIso(value: unknown): string {
  if (value && typeof value === "object" && "toDate" in value) return (value as Timestamp).toDate().toISOString();
  return typeof value === "string" ? value : new Date().toISOString();
}

function mapRouteMatch(id: string, data: DocumentData): RouteMatch {
  return {
    id,
    originalOrderId: data.originalOrderId,
    returnOrderId: data.returnOrderId,
    originalOrigin: data.originalOrigin,
    originalDestination: data.originalDestination,
    returnOrigin: data.returnOrigin,
    returnDestination: data.returnDestination,
    emptyKmBefore: Number(data.emptyKmBefore),
    repositionKm: Number(data.repositionKm),
    emptyKmAfter: Number(data.emptyKmAfter),
    savedKm: Number(data.savedKm),
    fuelSavedLiters: Number(data.fuelSavedLiters),
    estimatedSavingsKzt: Number(data.estimatedSavingsKzt),
    matchScore: Number(data.matchScore),
    matchType: data.matchType,
    reason: data.reason,
    createdAt: toIso(data.createdAt),
  };
}

export function subscribeToRouteMatches(onData: (matches: RouteMatch[]) => void, onError: (error: FirestoreError) => void): Unsubscribe {
  const db = requireFirestore();
  return onSnapshot(collection(db, "routeMatches"), (snapshot) => onData(snapshot.docs.map((item) => mapRouteMatch(item.id, item.data()))), onError);
}

export async function acceptAndPersistRouteMatch(match: RankedRouteMatch, carrier: CarrierProfile): Promise<void> {
  const db = requireFirestore();
  const returnOrderRef = doc(db, "orders", match.returnOrderId);
  const matchRef = doc(db, "routeMatches", match.id);
  await runTransaction(db, async (transaction) => {
    const existingMatch = await transaction.get(matchRef);
    await stageOrderAcceptance(transaction, returnOrderRef, carrier);
    if (!existingMatch.exists()) {
      const { returnOrder: _returnOrder, createdAt: _createdAt, ...persistedMatch } = match;
      void _returnOrder; void _createdAt;
      transaction.set(matchRef, { ...persistedMatch, createdAt: serverTimestamp() });
    }
  });
}
