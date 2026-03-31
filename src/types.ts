export interface Farmer {
  id: string;
  name: string;
  county: string;
  town: string;
  gps_lat: number;
  gps_lng: number;
  crops: string[];
  farm_size_acres: number;
  language_preference: 'en' | 'sw' | 'sheng';
  created_at: any;
  last_active: any;
}

export interface FieldData {
  alu_field_boundary?: any[];
  alu_acreage?: number;
  alu_water_bodies?: any[];
  amed_detected_crop?: string;
  amed_crop_stage?: string;
  amed_sowing_date?: string;
  amed_harvest_estimate?: string;
  amed_ndvi?: number;
  amed_last_updated?: any;
  historical_seasons?: any[];
}

export interface Message {
  role: 'user' | 'model';
  content: string;
  timestamp: string;
}

export interface Conversation {
  id: string;
  messages: Message[];
  session_date: any;
  topics_covered: string[];
  photos_analyzed: string[];
}

export interface DiseaseReport {
  id: string;
  farmer_id: string;
  county: string;
  location_lat: number;
  location_lng: number;
  disease_identified: string;
  confidence: 'High' | 'Medium' | 'Low';
  photo_url: string;
  timestamp: any;
  verified: boolean;
}
