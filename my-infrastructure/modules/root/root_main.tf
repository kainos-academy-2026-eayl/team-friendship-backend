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

module "resource-group" {
  source = "../resource-group"

  resource_group_name = "team-friendship-rg-13-11-2026"
  environment         = "dev"
}
