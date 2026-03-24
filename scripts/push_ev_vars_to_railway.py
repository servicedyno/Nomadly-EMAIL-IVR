#!/usr/bin/env python3
"""
Push Email Validation Environment Variables to Railway via API
Usage: python3 push_ev_vars_to_railway.py [--project-id PROJECT_ID] [--service-id SERVICE_ID] [--env production]
"""

import requests
import json
import sys
import os

# Railway API Configuration
API_URL = "https://backboard.railway.app/graphql/v2"
API_KEY = os.getenv("API_KEY_RAILWAY", "5c463b97-111b-4116-a571-475613fd51e2")

# Email Validation Environment Variables
EV_VARIABLES = {
    "EMAIL_VALIDATION_ON": "true",
    "EV_TIER_1_MAX": "1000",
    "EV_TIER_1_PRICE": "0.005",
    "EV_TIER_2_MAX": "10000",
    "EV_TIER_2_PRICE": "0.004",
    "EV_TIER_3_MAX": "50000",
    "EV_TIER_3_PRICE": "0.003",
    "EV_TIER_4_MAX": "100000",
    "EV_TIER_4_PRICE": "0.002",
    "EV_MIN_EMAILS": "10",
    "EV_MAX_EMAILS": "100000",
    "EV_MAX_PASTE": "100",
    "EV_WORKER_URL": "http://5.189.166.127:8787",
    "EV_WORKER_SECRET": "ev-worker-secret-2026",
    "EV_WORKER_BATCH": "100",
    "EV_WORKER_TIMEOUT": "120000",
    "EV_USE_DIRECT_SMTP": "false",
    "EV_DOMAIN_CONCURRENCY": "10",
    "EV_PROGRESS_INTERVAL": "20",
}

def graphql_request(query, variables=None):
    """Make a GraphQL request to Railway API"""
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {"query": query}
    if variables:
        payload["variables"] = variables
    
    response = requests.post(API_URL, json=payload, headers=headers)
    response.raise_for_status()
    return response.json()

def list_projects():
    """List all Railway projects"""
    query = """
    query {
      me {
        projects(first: 20) {
          edges {
            node {
              id
              name
              description
              services {
                edges {
                  node {
                    id
                    name
                  }
                }
              }
              environments {
                edges {
                  node {
                    id
                    name
                  }
                }
              }
            }
          }
        }
      }
    }
    """
    result = graphql_request(query)
    return result['data']['me']['projects']['edges']

def set_variable(environment_id, name, value):
    """Set a single environment variable"""
    query = """
    mutation VariableUpsert($input: VariableUpsertInput!) {
      variableUpsert(input: $input)
    }
    """
    variables = {
        "input": {
            "environmentId": environment_id,
            "name": name,
            "value": value
        }
    }
    try:
        result = graphql_request(query, variables)
        return True
    except Exception as e:
        print(f"  ⚠️  Error setting {name}: {e}")
        return False

def main():
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print("  Railway Email Validation Variables Pusher")
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print()
    
    # Get command line arguments
    import argparse
    parser = argparse.ArgumentParser(description='Push email validation vars to Railway')
    parser.add_argument('--project-id', help='Railway project ID', default=None)
    parser.add_argument('--service-id', help='Railway service ID', default=None)
    parser.add_argument('--env', help='Environment name (production/staging)', default='production')
    args = parser.parse_args()
    
    # List projects
    print("📋 Fetching Railway projects...")
    projects = list_projects()
    
    if not projects:
        print("❌ No Railway projects found")
        return 1
    
    # Display projects
    print(f"\n📦 Found {len(projects)} project(s):\n")
    for i, project_edge in enumerate(projects, 1):
        project = project_edge['node']
        print(f"{i}. {project['name']} (ID: {project['id']})")
        
        # Show services
        services = project['services']['edges']
        if services:
            print(f"   Services:")
            for service_edge in services:
                service = service_edge['node']
                print(f"     - {service['name']} (ID: {service['id']})")
        
        # Show environments
        envs = project['environments']['edges']
        if envs:
            print(f"   Environments:")
            for env_edge in envs:
                env = env_edge['node']
                print(f"     - {env['name']} (ID: {env['id']})")
        print()
    
    # Prompt for project selection if not provided
    if not args.project_id:
        print("Please run this script with --project-id and --env flags")
        print("\nExample:")
        print(f"  python3 {sys.argv[0]} --project-id <PROJECT_ID> --env production")
        print("\nOr use Railway CLI instead:")
        print("  bash /app/scripts/push-email-validation-env-to-railway.sh")
        return 0
    
    # Find the environment
    target_env_id = None
    for project_edge in projects:
        project = project_edge['node']
        if project['id'] == args.project_id:
            for env_edge in project['environments']['edges']:
                env = env_edge['node']
                if env['name'].lower() == args.env.lower():
                    target_env_id = env['id']
                    break
    
    if not target_env_id:
        print(f"❌ Environment '{args.env}' not found in project")
        return 1
    
    print(f"🎯 Target environment: {args.env} (ID: {target_env_id})")
    print(f"\n📤 Setting {len(EV_VARIABLES)} email validation variables...\n")
    
    # Set each variable
    success_count = 0
    for name, value in EV_VARIABLES.items():
        if set_variable(target_env_id, name, value):
            print(f"  ✅ {name}={value}")
            success_count += 1
        else:
            print(f"  ❌ {name} (failed)")
    
    print()
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print(f"✅ Success! Set {success_count}/{len(EV_VARIABLES)} variables")
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print()
    print("🔄 Railway will automatically redeploy with new variables")
    print("⏱️  Deployment typically takes 2-3 minutes")
    print()
    
    return 0

if __name__ == "__main__":
    sys.exit(main())
