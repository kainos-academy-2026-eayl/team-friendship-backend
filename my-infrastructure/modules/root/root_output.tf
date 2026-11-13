# module.module-name.output-name
output "rg_public_name" {
  description = "Name of resource group"
  value       = module.resource-group.resource_group_name
}

output "rg_public_id" {
  description = "ID of resource group"
  value       = hi
}
