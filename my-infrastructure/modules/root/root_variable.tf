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
