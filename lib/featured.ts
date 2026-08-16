import {
  getFeatured as dbGetFeatured,
  addToFeatured as dbAdd,
  removeFromFeatured as dbRemove,
  clearFeatured as dbClear,
  updateFeaturedPositions as dbUpdatePositions,
} from "./db";

export type FeaturedItem = {
  id: number;
  movie_id: number;
  position: number;
  type: string;
  created_at: string;
};

export async function getFeatured(): Promise<FeaturedItem[]> {
  return dbGetFeatured();
}

export async function addToFeatured(
  movieId: number,
  type: string = "hero"
): Promise<number> {
  return dbAdd(movieId, type);
}

export async function removeFromFeatured(id: number): Promise<void> {
  return dbRemove(id);
}

export async function updateFeaturedPosition(
  id: number,
  newPosition: number
): Promise<void> {
  return dbUpdatePositions([{ id, position: newPosition }]);
}

export async function clearFeatured(): Promise<void> {
  return dbClear();
}
