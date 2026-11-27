terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
  }
}

provider "azurerm" {
  features {}
}

resource "azurerm_resource_group" "tfstate" {
  name     = "team-friendship-tfstate-rg"
  location = "UK South"
}

resource "azurerm_resource_group" "prod_tfstate" {
  name     = "team-friendship-prod-tfstate-rg"
  location = "UK South"
}

resource "azurerm_storage_account" "tfstate" {
  name                     = "teamfriendshiptfstate" # must be globally unique
  resource_group_name      = azurerm_resource_group.tfstate.name
  location                 = azurerm_resource_group.tfstate.location
  account_tier             = "Standard"
  account_replication_type = "LRS"

  lifecycle {
    prevent_destroy = true
  }
}

resource "azurerm_storage_account" "prod_tfstate" {
  name                     = "teamfriendshipprodstate" # must be globally unique
  resource_group_name      = azurerm_resource_group.prod_tfstate.name
  location                 = azurerm_resource_group.prod_tfstate.location
  account_tier             = "Standard"
  account_replication_type = "LRS"

  lifecycle {
    prevent_destroy = true
  }
}

resource "azurerm_storage_container" "tfstate" {
  name                  = "tfstate"
  storage_account_id    = azurerm_storage_account.tfstate.id
  container_access_type = "private"
}

resource "azurerm_storage_container" "prod_tfstate" {
  name                  = "prodtfstate"
  storage_account_id    = azurerm_storage_account.prod_tfstate.id
  container_access_type = "private"
}
