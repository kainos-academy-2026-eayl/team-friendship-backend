variable "resource_group_name" {
  description = "Name of the resource group to deploy into." # shown in prompts and docs
  type        = string                                       # plain text value
  default     = "team-friendship-rg-prod"
}

variable "environment" {
  description = "Deployment environment (e.g., dev, staging, prod)." # shown in prompts and docs
  type        = string                                               # plain text value
  default     = "prod"
}

variable "prod_resource_group_name" {
  description = "Name of the resource group to deploy into for the production environment." # shown in prompts and docs
  type        = string                                                                      # plain text value
  default     = "team-friendship-rg-prod"
}
