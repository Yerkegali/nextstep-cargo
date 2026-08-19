export type AIAnalysisType = "return_route_analysis" | "regional_flow_analysis";

export interface AIAnalysisResponse {
  title: string;
  summary: string;
  insights: string[];
  recommendation?: string;
  disclaimer?: string;
}

export interface SafeRouteMatchFacts {
  origin: string;
  destination: string;
  matchScore: number;
  matchType: "direct_return" | "nearby_return" | "partial_return";
  emptyKmBefore: number;
  repositionKm: number;
  emptyKmAfter: number;
  savedKm: number;
  fuelSavedLiters: number;
  estimatedSavingsKzt: number;
}

export interface ReturnRouteAnalysisPayload {
  completedRoute: { origin: string; destination: string; distanceKm: number };
  recommendedMatch: SafeRouteMatchFacts;
  alternatives: SafeRouteMatchFacts[];
}

export interface RegionalFlowAnalysisPayload {
  availableOrders: number;
  activeDeliveries: number;
  deliveredOrders: number;
  acceptedReturnMatches: number;
  savings: { savedKm: number; fuelSavedLiters: number; estimatedSavingsKzt: number };
  corridors: Array<{ from: string; to: string; orders: number }>;
  imbalances: Array<{ locationA: string; locationB: string; aToB: number; bToA: number; difference: number; dominantDirection: string | null }>;
}

export type AIAnalysisRequest =
  | { type: "return_route_analysis"; data: ReturnRouteAnalysisPayload }
  | { type: "regional_flow_analysis"; data: RegionalFlowAnalysisPayload };

export interface AIAnalysisApiSuccess {
  analysis: AIAnalysisResponse;
  generatedAt: string;
}

