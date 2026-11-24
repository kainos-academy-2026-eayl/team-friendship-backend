# module.module-name.output-name

output "rg_public_name" {
  description = "Name of resource group"
  value       = module.resource-group.resource_group_name
}

output "key_vault_uri" {
  value = azurerm_key_vault.app.vault_uri
}
