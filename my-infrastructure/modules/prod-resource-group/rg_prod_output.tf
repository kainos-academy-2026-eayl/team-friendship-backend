output "prod_resource_group_name" {
  value = azurerm_resource_group.rg.name
}

output "prod_location" {
  value = azurerm_resource_group.rg.location
}
