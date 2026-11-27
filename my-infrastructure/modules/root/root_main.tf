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

# Database

data "azurerm_key_vault_secret" "postgres_user" {
  name         = "POSTGRES-USER"
  key_vault_id = azurerm_key_vault.app.id
}

data "azurerm_key_vault_secret" "postgres_password" {
  name         = "POSTGRES-PASSWORD"
  key_vault_id = azurerm_key_vault.app.id
}

# backend container app

resource "azurerm_container_app" "backend" {
  name                         = "team-friendship-backend-ca"
  resource_group_name          = module.resource-group.resource_group_name
  container_app_environment_id = azurerm_container_app_environment.app.id
  revision_mode                = "Single"

  ingress {
    external_enabled = false
    target_port      = 3000
    traffic_weight {

      latest_revision = true
      percentage      = 100
    }
  }

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.app.id]
  }

  registry {
    server   = var.acr_login_server
    identity = azurerm_user_assigned_identity.app.id
  }

  template {
    min_replicas = 1
    max_replicas = 1

    container {
      name   = "team-friendship-backend-container"
      image  = var.backend_image
      cpu    = 0.5
      memory = "1.0Gi"

      env {
        name  = "PORT"
        value = 3000
      }
      env {
        name  = "HOST"
        value = "0.0.0.0"
      }
      env {
        name        = "JWT_ACCESS_SECRET"
        secret_name = "jwt-access-secret-ref"
      }
      env {
        name        = "DATABASE_URL"
        secret_name = "database-url-ref"
      }
    }

    container {
      name   = "postgres"
      image  = "postgres:17-alpine"
      cpu    = 0.5
      memory = "1.0Gi"

      env {
        name        = "POSTGRES_USER"
        secret_name = "postgres-user"
      }

      env {
        name        = "POSTGRES_PASSWORD"
        secret_name = "postgres-password"
      }

      env {
        name  = "POSTGRES_DB"
        value = var.db_name
      }

      env {
        name        = "POSTGRES_ADMIN_USER"
        secret_name = "admin-username"
      }

      env {
        name        = "POSTGRES_ADMIN_PASSWORD"
        secret_name = "admin-password"
      }

      env {
        name        = "POSTGRES_MAILER"
        secret_name = "mailer"
      }

      env {
        name        = "POSTGRES_MAILER_PASSWORD"
        secret_name = "mailer-password"
      }

      env {
        name        = "POSTGRES_ADMIN_EMAIL"
        secret_name = "admin-email"
      }

      env {
        name        = "POSTGRES_MAILER_EMAIL"
        secret_name = "mailer-email"
      }
    }
  }

  secret {
    name                = "jwt-access-secret-ref"
    key_vault_secret_id = "${azurerm_key_vault.app.vault_uri}secrets/JWT-ACCESS-SECRET"
    identity            = azurerm_user_assigned_identity.app.id
  }

  secret {
    name                = "database-url-ref"
    key_vault_secret_id = "${azurerm_key_vault.app.vault_uri}secrets/DATABASE-URL"
    identity            = azurerm_user_assigned_identity.app.id
  }

  secret {
    name                = "postgres-user"
    key_vault_secret_id = "${azurerm_key_vault.app.vault_uri}secrets/POSTGRES-USER"
    identity            = azurerm_user_assigned_identity.app.id
  }

  secret {
    name                = "postgres-password"
    key_vault_secret_id = "${azurerm_key_vault.app.vault_uri}secrets/POSTGRES-PASSWORD"
    identity            = azurerm_user_assigned_identity.app.id
  }

  secret {
    name                = "sender-email"
    key_vault_secret_id = "${azurerm_key_vault.app.vault_uri}secrets/SENDER-EMAIL"
    identity            = azurerm_user_assigned_identity.app.id
  }

  secret {
    name                = "mail-from-name"
    key_vault_secret_id = "${azurerm_key_vault.app.vault_uri}secrets/MAIL-FROM-NAME"
    identity            = azurerm_user_assigned_identity.app.id
  }

  secret {
    name                = "mail-encryption"
    key_vault_secret_id = "${azurerm_key_vault.app.vault_uri}secrets/MAIL-ENCRYPTION"
    identity            = azurerm_user_assigned_identity.app.id
  }

  secret {
    name                = "mail-password"
    key_vault_secret_id = "${azurerm_key_vault.app.vault_uri}secrets/MAIL-PASSWORD"
    identity            = azurerm_user_assigned_identity.app.id
  }

  secret {
    name                = "mail-username"
    key_vault_secret_id = "${azurerm_key_vault.app.vault_uri}secrets/MAIL-USERNAME"
    identity            = azurerm_user_assigned_identity.app.id
  }

  secret {
    name                = "mail-port"
    key_vault_secret_id = "${azurerm_key_vault.app.vault_uri}secrets/MAIL-PORT"
    identity            = azurerm_user_assigned_identity.app.id
  }

  secret {
    name                = "mail-host"
    key_vault_secret_id = "${azurerm_key_vault.app.vault_uri}secrets/MAIL-HOST"
    identity            = azurerm_user_assigned_identity.app.id
  }

  secret {
    name                = "mail-mailer"
    key_vault_secret_id = "${azurerm_key_vault.app.vault_uri}secrets/MAIL-MAILER"
    identity            = azurerm_user_assigned_identity.app.id
  }

  secret {
    name                = "admin-username"
    key_vault_secret_id = "${azurerm_key_vault.app.vault_uri}secrets/ADMIN-USERNAME"
    identity            = azurerm_user_assigned_identity.app.id
  }

  secret {
    name                = "admin-password"
    key_vault_secret_id = "${azurerm_key_vault.app.vault_uri}secrets/ADMIN-PASSWORD"
    identity            = azurerm_user_assigned_identity.app.id
  }

}

# frontend container app

resource "azurerm_container_app" "frontend" {
  name                         = "team-friendship-frontend-ca"
  resource_group_name          = module.resource-group.resource_group_name
  container_app_environment_id = azurerm_container_app_environment.app.id
  revision_mode                = "Single"

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.app.id]
  }

  registry {
    server   = var.acr_login_server
    identity = azurerm_user_assigned_identity.app.id
  }

  ingress {
    external_enabled = true
    target_port      = 8000

    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }

  template {
    min_replicas = 1
    max_replicas = 1

    container {
      name   = "team-friendship-frontend-container"
      image  = var.frontend_image
      cpu    = 0.5
      memory = "1.0Gi"

      env {
        name  = "PORT"
        value = 8000
      }
      env {
        name  = "HOST"
        value = "0.0.0.0"
      }
      env {
        name  = "BACKEND_URL"
        value = "https://${azurerm_container_app.backend.ingress[0].fqdn}"
      }
    }
  }
}
