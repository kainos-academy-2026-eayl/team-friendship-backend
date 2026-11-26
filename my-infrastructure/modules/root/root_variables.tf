
variable "resource_group_name" {
  description = "Name of the resource group to deploy into."
  type        = string
}

variable "environment" {
  description = "Deployment environment (e.g., dev, staging, prod)."
  type        = string
}

variable "key_vault_name" {
  description = "Name of the key vault to deploy into."
  type        = string
}

variable "identity_name" {
  description = "Name of the user-assigned identity to deploy into."
  type        = string
}