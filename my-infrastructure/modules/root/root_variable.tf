variable "backend_image" {
  description = "Docker image for the backend container."
  type        = string
}

variable "frontend_image" {
  description = "Docker image for the frontend container."
  type        = string
}

variable "acr_login_server" {
  description = "Login server of the existing ACR."
  type        = string
}

variable "db_name" {
  description = "Name of the database inside the PostgreSQL flexible server."
  type        = string
  default     = "team-friendship-db"
}
