export interface Garden {
  id: number;
  name: string;
  location: string;
  hardiness_zone: string;
  created_at: string;
}

export interface GardenTask {
  id: number;
  garden_id: number;
  title: string;
  due_date: string;
  plant: string;
  notes: string;
  completed: boolean;
  created_at: string;
}

export interface GardenPlant {
  id: number;
  garden_id: number;
  name: string;
  variety: string;
  quantity: number;
  planted_date: string;
  notes: string;
  active: boolean;
  created_at: string;
}

export interface KnowledgeDocument {
  id: number;
  title: string;
  content: string;
  source_url: string;
  publisher: string;
  region: string;
  tags: string[];
  created_at: string;
}

export interface SearchResult extends Omit<KnowledgeDocument, "content"> {
  score: number;
  excerpt: string;
}
