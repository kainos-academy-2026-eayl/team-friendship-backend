terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm" # official Azure provider
      version = "~> 4.0"            # any 4.x release
    }
  }
  backend "azurerm" {
    resource_group_name  = "team-friendship-rg"
    storage_account_name = "teamfriendshipstorage"
    container_name       = "team-friendship-practice-container"
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

resource "azurerm_storage_account" "practice" {
  name                     = "teamfriendshipstorage"
  resource_group_name      = module.resource-group.resource_group_name
  location                 = module.resource-group.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
}

resource "azurerm_storage_container" "practice_container" {
  name                  = "team-friendship-practice-container"
  storage_account_id    = azurerm_storage_account.practice.id
  container_access_type = "private"
}

