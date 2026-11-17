terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm" # official Azure provider
      version = "~> 4.0"            # any 4.x release
    }
  }
  backend "azurerm" {
    resource_group_name  = "team-friendship-rg"
    storage_account_name = "teamfriendshiptfstate"
    container_name       = "tfstate"
    key                  = "root.terraform.tfstate"
    use_azuread_auth     = true
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
