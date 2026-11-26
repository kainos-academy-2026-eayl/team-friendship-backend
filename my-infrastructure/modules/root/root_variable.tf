variable "backend-image" {
  description = "Docker image for the backend container." # shown in prompts and docs
  type        = string                                    # plain text value
  default     = "${{secrets.ACR_LOGIN_SERVER}}/team-friendship-backend:sha-$${{github.sha}}"
}

variable "frontend-image" {
  description = "Docker image for the frontend container." # shown in prompts and docs
  type        = string                                     # plain text value
  default     = "${{secrets.ACR_LOGIN_SERVER}}/team-friendship-frontend:sha-${{github.sha}}"
}