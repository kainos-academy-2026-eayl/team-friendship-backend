terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm" # official Azure provider
      version = "~> 4.0"            # any 4.x release
    }
  }
  backend "azurerm" {
    resource_group_name  = "team-friendship-tfstate-rg"
    storage_account_name = "teamfriendshiptfstate"
    container_name       = "tfstate"
    key                  = "root.terraform.tfstate"
  }
}

provider "azurerm" {
  features {}
}

module "resource-group" {
  source = "../resource-group"

  resource_group_name = "team-friendship-rg"
  environment         = "dev"
}

data "azurerm_client_config" "current" {} # Retrieves information about the current Azure client (subscription, tenant, etc)

resource "azurerm_key_vault" "app" {
  name                = "team-friendship-kv"
  resource_group_name = module.resource-group.resource_group_name
  location            = module.resource-group.location
  tenant_id           = data.azurerm_client_config.current.tenant_id

  sku_name                   = "standard" # Standard stock keeping unit tier
  rbac_authorization_enabled = true       # Enforces rbac
  soft_delete_retention_days = 90         # Deleted secrets are held for 90 days
  purge_protection_enabled   = true       # Prevents the kv from being purged during retention period
}

resource "azurerm_user_assigned_identity" "app" {
  name                = "team-friendship-uami"
  resource_group_name = module.resource-group.resource_group_name
  location            = module.resource-group.location
}

resource "azurerm_container_app_environment" "app" {
  name                = "team-friendship-container-app-env"
  resource_group_name = module.resource-group.resource_group_name
  location            = module.resource-group.location
}

resource "azurerm_container_registry" "app" {
  name                = "acraiacademy26"
  resource_group_name = module.resource-group.resource_group_name
  location            = module.resource-group.location
  sku                 = "Standard"
  admin_enabled       = false
}

//resource "azurerm_role_assignment" "app_registry_pull" {
//  scope                = azurerm_container_registry.app.id
//  role_definition_name = "AcrPull"
//  principal_id         = azurerm_user_assigned_identity.app.principal_id
//}

//resource "azurerm_role_assignment" "app_key_vault_secrets" {
//  scope                = azurerm_key_vault.app.id
//  role_definition_name = "Key Vault Secrets User"
//  principal_id         = azurerm_user_assigned_identity.app.principal_id
//}