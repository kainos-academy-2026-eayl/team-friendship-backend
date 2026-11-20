variable "resource_group_name" {
  description = "Name of the resource group to deploy into." # shown in prompts and docs
  type        = string                                       # plain text value
  default     = "team-friendship-rg"
}

variable "environment" {
  description = "Deployment environment (e.g., dev, staging, prod)." # shown in prompts and docs
  type        = string                                               # plain text value
  default     = "dev"
}

variable "test_tag" {
  description = "Temporary tag value for testing Terraform plans."
  type        = string
  default     = "terraform-plan-test"
}
