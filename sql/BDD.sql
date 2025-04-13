[
  {
    "table_name": "chat_messages",
    "column_name": "id",
    "data_type": "uuid"
  },
  {
    "table_name": "chat_messages",
    "column_name": "job_id",
    "data_type": "uuid"
  },
  {
    "table_name": "chat_messages",
    "column_name": "sender_id",
    "data_type": "uuid"
  },
  {
    "table_name": "chat_messages",
    "column_name": "receiver_id",
    "data_type": "uuid"
  },
  {
    "table_name": "chat_messages",
    "column_name": "content",
    "data_type": "text"
  },
  {
    "table_name": "chat_messages",
    "column_name": "is_read",
    "data_type": "boolean"
  },
  {
    "table_name": "chat_messages",
    "column_name": "created_at",
    "data_type": "timestamp with time zone"
  },
  {
    "table_name": "chat_messages",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone"
  },
  {
    "table_name": "chat_messages",
    "column_name": "image_url",
    "data_type": "text"
  },
  {
    "table_name": "chat_messages",
    "column_name": "meta",
    "data_type": "jsonb"
  },
  {
    "table_name": "jobs",
    "column_name": "id",
    "data_type": "uuid"
  },
  {
    "table_name": "jobs",
    "column_name": "offer_id",
    "data_type": "uuid"
  },
  {
    "table_name": "jobs",
    "column_name": "client_id",
    "data_type": "uuid"
  },
  {
    "table_name": "jobs",
    "column_name": "prestataire_id",
    "data_type": "uuid"
  },
  {
    "table_name": "jobs",
    "column_name": "tracking_status",
    "data_type": "text"
  },
  {
    "table_name": "jobs",
    "column_name": "is_completed",
    "data_type": "boolean"
  },
  {
    "table_name": "jobs",
    "column_name": "created_at",
    "data_type": "timestamp with time zone"
  },
  {
    "table_name": "jobs",
    "column_name": "completed_at",
    "data_type": "timestamp with time zone"
  },
  {
    "table_name": "kyc",
    "column_name": "id",
    "data_type": "uuid"
  },
  {
    "table_name": "kyc",
    "column_name": "user_id",
    "data_type": "uuid"
  },
  {
    "table_name": "kyc",
    "column_name": "doc_url",
    "data_type": "text"
  },
  {
    "table_name": "kyc",
    "column_name": "status",
    "data_type": "text"
  },
  {
    "table_name": "kyc",
    "column_name": "created_at",
    "data_type": "timestamp with time zone"
  },
  {
    "table_name": "kyc_documents",
    "column_name": "id",
    "data_type": "uuid"
  },
  {
    "table_name": "kyc_documents",
    "column_name": "user_id",
    "data_type": "uuid"
  },
  {
    "table_name": "kyc_documents",
    "column_name": "status",
    "data_type": "text"
  },
  {
    "table_name": "kyc_documents",
    "column_name": "created_at",
    "data_type": "timestamp with time zone"
  },
  {
    "table_name": "kyc_documents",
    "column_name": "document_urls",
    "data_type": "jsonb"
  },
  {
    "table_name": "notifications",
    "column_name": "id",
    "data_type": "uuid"
  },
  {
    "table_name": "notifications",
    "column_name": "user_id",
    "data_type": "uuid"
  },
  {
    "table_name": "notifications",
    "column_name": "title",
    "data_type": "text"
  },
  {
    "table_name": "notifications",
    "column_name": "body",
    "data_type": "text"
  },
  {
    "table_name": "notifications",
    "column_name": "data",
    "data_type": "jsonb"
  },
  {
    "table_name": "notifications",
    "column_name": "read",
    "data_type": "boolean"
  },
  {
    "table_name": "notifications",
    "column_name": "created_at",
    "data_type": "timestamp with time zone"
  },
  {
    "table_name": "offers",
    "column_name": "id",
    "data_type": "uuid"
  },
  {
    "table_name": "offers",
    "column_name": "request_id",
    "data_type": "uuid"
  },
  {
    "table_name": "offers",
    "column_name": "prestataire_id",
    "data_type": "uuid"
  },
  {
    "table_name": "offers",
    "column_name": "price",
    "data_type": "numeric"
  },
  {
    "table_name": "offers",
    "column_name": "status",
    "data_type": "text"
  },
  {
    "table_name": "offers",
    "column_name": "created_at",
    "data_type": "timestamp with time zone"
  },
  {
    "table_name": "offers",
    "column_name": "payment_status",
    "data_type": "text"
  },
  {
    "table_name": "prestataire_activations",
    "column_name": "id",
    "data_type": "uuid"
  },
  {
    "table_name": "prestataire_activations",
    "column_name": "user_id",
    "data_type": "uuid"
  },
  {
    "table_name": "prestataire_activations",
    "column_name": "status",
    "data_type": "text"
  },
  {
    "table_name": "prestataire_activations",
    "column_name": "notes",
    "data_type": "text"
  },
  {
    "table_name": "prestataire_activations",
    "column_name": "created_at",
    "data_type": "timestamp with time zone"
  },
  {
    "table_name": "prestataire_activations",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone"
  },
  {
    "table_name": "prestataire_activations",
    "column_name": "admin_id",
    "data_type": "uuid"
  },
  {
    "table_name": "prestataire_activations",
    "column_name": "is_active",
    "data_type": "boolean"
  },
  {
    "table_name": "prestataire_services",
    "column_name": "id",
    "data_type": "uuid"
  },
  {
    "table_name": "prestataire_services",
    "column_name": "prestataire_id",
    "data_type": "uuid"
  },
  {
    "table_name": "prestataire_services",
    "column_name": "service_id",
    "data_type": "text"
  },
  {
    "table_name": "prestataire_services",
    "column_name": "experience_years",
    "data_type": "integer"
  },
  {
    "table_name": "prestataire_services",
    "column_name": "hourly_rate",
    "data_type": "numeric"
  },
  {
    "table_name": "prestataire_services",
    "column_name": "created_at",
    "data_type": "timestamp with time zone"
  },
  {
    "table_name": "prestataire_services",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone"
  },
  {
    "table_name": "prestataire_services_view",
    "column_name": "id",
    "data_type": "uuid"
  },
  {
    "table_name": "prestataire_services_view",
    "column_name": "prestataire_id",
    "data_type": "uuid"
  },
  {
    "table_name": "prestataire_services_view",
    "column_name": "service_id",
    "data_type": "text"
  },
  {
    "table_name": "prestataire_services_view",
    "column_name": "service_name",
    "data_type": "text"
  },
  {
    "table_name": "prestataire_services_view",
    "column_name": "service_category",
    "data_type": "text"
  },
  {
    "table_name": "prestataire_services_view",
    "column_name": "experience_years",
    "data_type": "integer"
  },
  {
    "table_name": "prestataire_services_view",
    "column_name": "hourly_rate",
    "data_type": "numeric"
  },
  {
    "table_name": "prestataire_services_view",
    "column_name": "prestataire_name",
    "data_type": "text"
  },
  {
    "table_name": "prestataire_services_view",
    "column_name": "prestataire_email",
    "data_type": "text"
  },
  {
    "table_name": "prestataire_services_view",
    "column_name": "is_verified",
    "data_type": "boolean"
  },
  {
    "table_name": "prestataire_services_view",
    "column_name": "is_active",
    "data_type": "boolean"
  },
  {
    "table_name": "requests",
    "column_name": "id",
    "data_type": "uuid"
  },
  {
    "table_name": "requests",
    "column_name": "client_id",
    "data_type": "uuid"
  },
  {
    "table_name": "requests",
    "column_name": "service_id",
    "data_type": "text"
  },
  {
    "table_name": "requests",
    "column_name": "location",
    "data_type": "jsonb"
  },
  {
    "table_name": "requests",
    "column_name": "urgency",
    "data_type": "integer"
  },
  {
    "table_name": "requests",
    "column_name": "photos",
    "data_type": "ARRAY"
  },
  {
    "table_name": "requests",
    "column_name": "notes",
    "data_type": "text"
  },
  {
    "table_name": "requests",
    "column_name": "status",
    "data_type": "text"
  },
  {
    "table_name": "requests",
    "column_name": "created_at",
    "data_type": "timestamp with time zone"
  },
  {
    "table_name": "requests",
    "column_name": "prestataire_status",
    "data_type": "text"
  },
  {
    "table_name": "requests",
    "column_name": "is_reviewed",
    "data_type": "boolean"
  },
  {
    "table_name": "requests_by_service",
    "column_name": "id",
    "data_type": "uuid"
  },
  {
    "table_name": "requests_by_service",
    "column_name": "client_id",
    "data_type": "uuid"
  },
  {
    "table_name": "requests_by_service",
    "column_name": "service_id",
    "data_type": "text"
  },
  {
    "table_name": "requests_by_service",
    "column_name": "location",
    "data_type": "jsonb"
  },
  {
    "table_name": "requests_by_service",
    "column_name": "urgency",
    "data_type": "integer"
  },
  {
    "table_name": "requests_by_service",
    "column_name": "photos",
    "data_type": "ARRAY"
  },
  {
    "table_name": "requests_by_service",
    "column_name": "notes",
    "data_type": "text"
  },
  {
    "table_name": "requests_by_service",
    "column_name": "status",
    "data_type": "text"
  },
  {
    "table_name": "requests_by_service",
    "column_name": "created_at",
    "data_type": "timestamp with time zone"
  },
  {
    "table_name": "requests_by_service",
    "column_name": "prestataire_status",
    "data_type": "text"
  },
  {
    "table_name": "requests_by_service",
    "column_name": "is_reviewed",
    "data_type": "boolean"
  },
  {
    "table_name": "requests_by_service",
    "column_name": "service_name",
    "data_type": "text"
  },
  {
    "table_name": "requests_by_service",
    "column_name": "service_category",
    "data_type": "text"
  },
  {
    "table_name": "requests_with_services",
    "column_name": "id",
    "data_type": "uuid"
  },
  {
    "table_name": "requests_with_services",
    "column_name": "client_id",
    "data_type": "uuid"
  },
  {
    "table_name": "requests_with_services",
    "column_name": "service_id",
    "data_type": "text"
  },
  {
    "table_name": "requests_with_services",
    "column_name": "location",
    "data_type": "jsonb"
  },
  {
    "table_name": "requests_with_services",
    "column_name": "urgency",
    "data_type": "integer"
  },
  {
    "table_name": "requests_with_services",
    "column_name": "photos",
    "data_type": "ARRAY"
  },
  {
    "table_name": "requests_with_services",
    "column_name": "notes",
    "data_type": "text"
  },
  {
    "table_name": "requests_with_services",
    "column_name": "status",
    "data_type": "text"
  }
]