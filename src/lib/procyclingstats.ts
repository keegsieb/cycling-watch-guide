export interface Race {
  name: string;
  slug: string;
  url: string;
  startDate: string;
  endDate: string;
  category: string;
  country: string;
  /** For stage races, the list of stages. For one-day races, a single entry. */
  stages: Stage[];
}

export interface Stage {
  name: string;
  /** e.g. "Stage 1", "Stage 2", or the race name for one-day races */
  label: string;
  url: string;
  /** The direct URL to the profile image on PCS */
  profileImageUrl: string | null;
  /** Total race/stage distance in km, if extractable */
  distanceKm: number | null;
  date: string;
}
