export enum UserRole {
  CLIENT = 'client',
  PRESTAIRE = 'prestataire',
  ADMIN = 'admin'
}

export enum RequestStatus {
  PENDING = 'pending',
  OFFERED = 'offered',
  ACCEPTED = 'accepted',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

export enum OfferStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected'
}

export enum TrackingStatus {
  NOT_STARTED = 'not_started',
  EN_ROUTE = 'en_route',
  ARRIVED = 'arrived',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed'
}

export enum KYCStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
  REJECTED = 'rejected'
}

export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded'
}

export interface User {
  id: string;
  email: string;
  role: UserRole;
  phone?: string;
  is_verified: boolean;
  is_active: boolean;
  created_at: string;
  profile_picture?: string;
  profile_picture_base64?: string;
  name?: string;
  address?: string;
  business_reg_number?: string;
  kyc_submitted?: boolean;
  stripe_account_id?: string;
  stripe_account_enabled?: boolean;
}

export interface KYC {
  id: string;
  user_id: string;
  doc_url: string;
  status: KYCStatus;
  created_at: string;
}

export interface Service {
  id: string;
  name: string;
  category: string;
  description: string;
}

export interface Request {
  id: string;
  client_id: string;
  service_id: string;
  location: {
    latitude: number;
    longitude: number;
    address: string;
  };
  urgency: number; // 1-5
  photos?: string[];
  notes?: string;
  status: RequestStatus;
  created_at: string;
  prestataire_status?: TrackingStatus; // Statut mis à jour par le prestataire
  is_reviewed?: boolean; // Indique si le client a déjà laissé un avis
}

export interface Offer {
  id: string;
  request_id: string;
  prestataire_id: string;
  price: number;
  status: OfferStatus;
  created_at: string;
  payment_status?: PaymentStatus;
}

export interface Job {
  id: string;
  offer_id: string;
  client_id: string;
  prestataire_id: string;
  tracking_status: TrackingStatus;
  is_completed: boolean;
  created_at: string;
  completed_at?: string;
}

export interface Transaction {
  id: string;
  job_id: string;
  amount: number;
  stripe_id: string;
  commission: number;
  payout_status: boolean;
  created_at: string;
  payment_status: PaymentStatus;
}

export interface Review {
  id: string;
  job_id: string;
  reviewer_id: string;
  reviewed_user_id: string; // ID de l'utilisateur évalué (prestataire ou client)
  rating: number; // 1-5
  comment?: string;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  job_id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
  image_url?: string; // URL de l'image stockée dans Supabase
}

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
  address?: string;
  formattedAddress?: string; // Adresse formatée retournée par reverse geocoding
}