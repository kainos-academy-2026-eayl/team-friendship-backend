terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm" # official Azure provider
      version = "~> 4.0"            # any 4.x release
    }
  }
}

provider "azurerm" {
  features {}
}

# create resource group for the project
resource "azurerm_resource_group" "rg" { # "resource-type", "resource-name"
  name     = "var.resource_group_name"
  location = "UK South"
}

