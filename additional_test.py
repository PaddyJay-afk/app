#!/usr/bin/env python3
"""
Additional tests with existing customer data
"""

import requests
import json

API_BASE_URL = "https://boattech.preview.emergentagent.com/api"
HEADERS = {"Content-Type": "application/json"}

def test_existing_customer():
    """Test operations with existing John Smith customer"""
    print("🔍 Testing with existing customer John Smith...")
    
    # Get existing customer
    response = requests.get(f"{API_BASE_URL}/customers")
    customers = response.json()
    
    john_smith = None
    for customer in customers:
        if customer.get('name') == 'John Smith':
            john_smith = customer
            break
    
    if not john_smith:
        print("❌ John Smith customer not found")
        return False
    
    customer_id = john_smith['id']
    print(f"✅ Found John Smith with ID: {customer_id}")
    print(f"   Boat: {john_smith['boat']['year']} {john_smith['boat']['make']} {john_smith['boat']['model']}")
    
    # Add a job to existing customer
    job_data = {
        "description": "Annual maintenance - check engine, replace spark plugs, service lower unit"
    }
    
    response = requests.post(f"{API_BASE_URL}/customers/{customer_id}/jobs", 
                           json=job_data, headers=HEADERS)
    if response.status_code == 200:
        job_result = response.json()
        job_id = job_result.get('job_id')
        print(f"✅ Added job to John Smith: {job_id}")
        
        # Update job status
        job_update = {"status": "in_progress"}
        response = requests.put(f"{API_BASE_URL}/customers/{customer_id}/jobs/{job_id}", 
                              json=job_update, headers=HEADERS)
        if response.status_code == 200:
            print("✅ Updated job status to in_progress")
        else:
            print(f"❌ Failed to update job status: {response.status_code}")
            
        # Add a note
        note_data = {
            "content": "Customer reported engine running rough at idle. Scheduled for carburetor cleaning.",
            "author": "Service Manager"
        }
        
        response = requests.post(f"{API_BASE_URL}/customers/{customer_id}/notes", 
                               json=note_data, headers=HEADERS)
        if response.status_code == 200:
            note_result = response.json()
            print(f"✅ Added note to John Smith: {note_result.get('note_id')}")
        else:
            print(f"❌ Failed to add note: {response.status_code}")
            
        # Verify customer data after modifications
        response = requests.get(f"{API_BASE_URL}/customers/{customer_id}")
        if response.status_code == 200:
            updated_customer = response.json()
            job_count = len(updated_customer.get('jobs', []))
            note_count = len(updated_customer.get('notes', []))
            print(f"✅ Customer now has {job_count} jobs and {note_count} notes")
            print(f"✅ Last activity updated: {updated_customer.get('last_activity')}")
        else:
            print(f"❌ Failed to retrieve updated customer: {response.status_code}")
            
    else:
        print(f"❌ Failed to add job: {response.status_code}")
        return False
    
    return True

if __name__ == "__main__":
    test_existing_customer()
