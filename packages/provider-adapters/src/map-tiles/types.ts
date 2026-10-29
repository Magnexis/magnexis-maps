export type MapStyleConfig = {
  id: "standard" | "dark" | "terrain" | "satellite";
  label: string;
  styleUrl: string;
  available: boolean;
  reasonUnavailable?: string;
};
