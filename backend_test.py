#!/usr/bin/env python3
"""
Comprehensive Backend API Testing for Boat Repair Customer Management System
Tests all CRUD operations, image management, job tracking, and notes system
"""

import requests
import json
import base64
import time
from datetime import datetime
from typing import Dict, Any, Optional

# API Configuration
API_BASE_URL = "https://boattech.preview.emergentagent.com/api"
HEADERS = {"Content-Type": "application/json"}

class BoatRepairAPITester:
    def __init__(self):
        self.base_url = API_BASE_URL
        self.headers = HEADERS
        self.test_customer_id = None
        self.test_job_id = None
        self.test_note_id = None
        self.test_image_id = None
        self.results = []
        
    def log_result(self, test_name: str, success: bool, details: str = "", response_data: Any = None):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        result = {
            "test": test_name,
            "status": status,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        if response_data:
            result["response"] = response_data
        self.results.append(result)
        print(f"{status} - {test_name}")
        if details:
            print(f"    Details: {details}")
        if not success and response_data:
            print(f"    Response: {response_data}")
        print()

    def test_api_health(self):
        """Test API root endpoint"""
        try:
            response = requests.get(f"{self.base_url}/", headers=self.headers, timeout=10)
            if response.status_code == 200:
                data = response.json()
                self.log_result("API Health Check", True, f"API is responding: {data.get('message', 'OK')}")
                return True
            else:
                self.log_result("API Health Check", False, f"Status: {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("API Health Check", False, f"Connection error: {str(e)}")
            return False

    def test_create_customer(self):
        """Test POST /api/customers - Create new customer"""
        customer_data = {
            "name": "Jane Doe",
            "phone": "+1-555-0123",
            "address": "123 Marina Drive, Boat Harbor, FL 33101",
            "boat": {
                "year": "2020",
                "make": "Sea Ray",
                "model": "Sundancer 320",
                "length": "32 ft",
                "hin": "SRYBA123K020"
            },
            "engine": {
                "engine_type": "Inboard",
                "serial_number": "MC8675309",
                "year": "2020",
                "make": "MerCruiser",
                "model": "6.2L V8",
                "horsepower": "350",
                "hours": "125"
            },
            "prop_type": "stainless"
        }
        
        try:
            response = requests.post(f"{self.base_url}/customers", 
                                   json=customer_data, headers=self.headers, timeout=10)
            if response.status_code == 200:
                data = response.json()
                self.test_customer_id = data.get('id')
                self.log_result("Create Customer", True, 
                               f"Customer created with ID: {self.test_customer_id}")
                
                # Verify all fields were saved correctly
                if (data.get('name') == customer_data['name'] and
                    data.get('boat', {}).get('make') == customer_data['boat']['make'] and
                    data.get('engine', {}).get('make') == customer_data['engine']['make'] and
                    data.get('prop_type') == customer_data['prop_type']):
                    self.log_result("Customer Data Integrity", True, "All fields saved correctly")
                else:
                    self.log_result("Customer Data Integrity", False, "Some fields not saved correctly", data)
                return True
            else:
                self.log_result("Create Customer", False, f"Status: {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("Create Customer", False, f"Error: {str(e)}")
            return False

    def test_get_customers(self):
        """Test GET /api/customers - List all customers"""
        try:
            response = requests.get(f"{self.base_url}/customers", headers=self.headers, timeout=10)
            if response.status_code == 200:
                data = response.json()
                customer_count = len(data)
                self.log_result("Get All Customers", True, f"Retrieved {customer_count} customers")
                
                # Check if our test customer is in the list
                if self.test_customer_id:
                    found_customer = any(c.get('id') == self.test_customer_id for c in data)
                    if found_customer:
                        self.log_result("Customer in List", True, "Test customer found in list")
                    else:
                        self.log_result("Customer in List", False, "Test customer not found in list")
                return True
            else:
                self.log_result("Get All Customers", False, f"Status: {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("Get All Customers", False, f"Error: {str(e)}")
            return False

    def test_get_specific_customer(self):
        """Test GET /api/customers/{id} - Get specific customer"""
        if not self.test_customer_id:
            self.log_result("Get Specific Customer", False, "No test customer ID available")
            return False
            
        try:
            response = requests.get(f"{self.base_url}/customers/{self.test_customer_id}", 
                                  headers=self.headers, timeout=10)
            if response.status_code == 200:
                data = response.json()
                self.log_result("Get Specific Customer", True, 
                               f"Retrieved customer: {data.get('name')}")
                return True
            else:
                self.log_result("Get Specific Customer", False, f"Status: {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("Get Specific Customer", False, f"Error: {str(e)}")
            return False

    def test_update_customer(self):
        """Test PUT /api/customers/{id} - Update customer"""
        if not self.test_customer_id:
            self.log_result("Update Customer", False, "No test customer ID available")
            return False
            
        update_data = {
            "phone": "+1-555-9999",
            "boat": {
                "year": "2021",
                "make": "Sea Ray",
                "model": "Sundancer 350",
                "length": "35 ft",
                "hin": "SRYBA123K021"
            }
        }
        
        try:
            response = requests.put(f"{self.base_url}/customers/{self.test_customer_id}", 
                                  json=update_data, headers=self.headers, timeout=10)
            if response.status_code == 200:
                data = response.json()
                # Verify last_activity was updated
                if 'last_activity' in data:
                    self.log_result("Update Customer", True, "Customer updated successfully")
                    self.log_result("Last Activity Update", True, "last_activity field updated")
                else:
                    self.log_result("Update Customer", True, "Customer updated")
                    self.log_result("Last Activity Update", False, "last_activity field not found")
                return True
            else:
                self.log_result("Update Customer", False, f"Status: {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("Update Customer", False, f"Error: {str(e)}")
            return False

    def test_add_image(self):
        """Test POST /api/customers/{id}/images - Add base64 image"""
        if not self.test_customer_id:
            self.log_result("Add Image", False, "No test customer ID available")
            return False
            
        # Create a simple base64 encoded test image (1x1 pixel PNG)
        test_image_b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
        
        image_data = {
            "base64_data": test_image_b64,
            "description": "Test engine compartment photo"
        }
        
        try:
            response = requests.post(f"{self.base_url}/customers/{self.test_customer_id}/images", 
                                   json=image_data, headers=self.headers, timeout=10)
            if response.status_code == 200:
                data = response.json()
                self.test_image_id = data.get('image_id')
                self.log_result("Add Image", True, f"Image added with ID: {self.test_image_id}")
                return True
            else:
                self.log_result("Add Image", False, f"Status: {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("Add Image", False, f"Error: {str(e)}")
            return False

    def test_add_job(self):
        """Test POST /api/customers/{id}/jobs - Add job"""
        if not self.test_customer_id:
            self.log_result("Add Job", False, "No test customer ID available")
            return False
            
        job_data = {
            "description": "Replace engine oil and filter, check cooling system"
        }
        
        try:
            response = requests.post(f"{self.base_url}/customers/{self.test_customer_id}/jobs", 
                                   json=job_data, headers=self.headers, timeout=10)
            if response.status_code == 200:
                data = response.json()
                self.test_job_id = data.get('job_id')
                self.log_result("Add Job", True, f"Job added with ID: {self.test_job_id}")
                return True
            else:
                self.log_result("Add Job", False, f"Status: {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("Add Job", False, f"Error: {str(e)}")
            return False

    def test_update_job_status(self):
        """Test PUT /api/customers/{id}/jobs/{job_id} - Update job status"""
        if not self.test_customer_id or not self.test_job_id:
            self.log_result("Update Job Status", False, "Missing customer or job ID")
            return False
            
        # Test status progression: pending -> in_progress -> completed
        statuses = ["in_progress", "completed"]
        
        for status in statuses:
            job_update = {"status": status}
            try:
                response = requests.put(f"{self.base_url}/customers/{self.test_customer_id}/jobs/{self.test_job_id}", 
                                      json=job_update, headers=self.headers, timeout=10)
                if response.status_code == 200:
                    self.log_result(f"Update Job to {status}", True, f"Job status updated to {status}")
                else:
                    self.log_result(f"Update Job to {status}", False, f"Status: {response.status_code}", response.text)
                    return False
            except Exception as e:
                self.log_result(f"Update Job to {status}", False, f"Error: {str(e)}")
                return False
        
        return True

    def test_add_note(self):
        """Test POST /api/customers/{id}/notes - Add timestamped note"""
        if not self.test_customer_id:
            self.log_result("Add Note", False, "No test customer ID available")
            return False
            
        note_data = {
            "content": "Customer mentioned unusual engine noise during startup. Scheduled for diagnostic.",
            "author": "Tech Mike"
        }
        
        try:
            response = requests.post(f"{self.base_url}/customers/{self.test_customer_id}/notes", 
                                   json=note_data, headers=self.headers, timeout=10)
            if response.status_code == 200:
                data = response.json()
                self.test_note_id = data.get('note_id')
                self.log_result("Add Note", True, f"Note added with ID: {self.test_note_id}")
                return True
            else:
                self.log_result("Add Note", False, f"Status: {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("Add Note", False, f"Error: {str(e)}")
            return False

    def test_error_handling(self):
        """Test error handling for non-existent IDs"""
        fake_id = "non-existent-id-12345"
        
        # Test get non-existent customer
        try:
            response = requests.get(f"{self.base_url}/customers/{fake_id}", headers=self.headers, timeout=10)
            if response.status_code == 404:
                self.log_result("Error Handling - Get Non-existent Customer", True, "Correctly returned 404")
            else:
                self.log_result("Error Handling - Get Non-existent Customer", False, f"Expected 404, got {response.status_code}")
        except Exception as e:
            self.log_result("Error Handling - Get Non-existent Customer", False, f"Error: {str(e)}")

        # Test add job to non-existent customer
        try:
            job_data = {"description": "Test job"}
            response = requests.post(f"{self.base_url}/customers/{fake_id}/jobs", 
                                   json=job_data, headers=self.headers, timeout=10)
            if response.status_code == 404:
                self.log_result("Error Handling - Add Job to Non-existent Customer", True, "Correctly returned 404")
            else:
                self.log_result("Error Handling - Add Job to Non-existent Customer", False, f"Expected 404, got {response.status_code}")
        except Exception as e:
            self.log_result("Error Handling - Add Job to Non-existent Customer", False, f"Error: {str(e)}")

    def test_delete_operations(self):
        """Test delete operations"""
        if not self.test_customer_id:
            self.log_result("Delete Operations", False, "No test customer ID available")
            return False

        # Delete image
        if self.test_image_id:
            try:
                response = requests.delete(f"{self.base_url}/customers/{self.test_customer_id}/images/{self.test_image_id}", 
                                         headers=self.headers, timeout=10)
                if response.status_code == 200:
                    self.log_result("Delete Image", True, "Image deleted successfully")
                else:
                    self.log_result("Delete Image", False, f"Status: {response.status_code}", response.text)
            except Exception as e:
                self.log_result("Delete Image", False, f"Error: {str(e)}")

        # Delete note
        if self.test_note_id:
            try:
                response = requests.delete(f"{self.base_url}/customers/{self.test_customer_id}/notes/{self.test_note_id}", 
                                         headers=self.headers, timeout=10)
                if response.status_code == 200:
                    self.log_result("Delete Note", True, "Note deleted successfully")
                else:
                    self.log_result("Delete Note", False, f"Status: {response.status_code}", response.text)
            except Exception as e:
                self.log_result("Delete Note", False, f"Error: {str(e)}")

        # Delete job
        if self.test_job_id:
            try:
                response = requests.delete(f"{self.base_url}/customers/{self.test_customer_id}/jobs/{self.test_job_id}", 
                                         headers=self.headers, timeout=10)
                if response.status_code == 200:
                    self.log_result("Delete Job", True, "Job deleted successfully")
                else:
                    self.log_result("Delete Job", False, f"Status: {response.status_code}", response.text)
            except Exception as e:
                self.log_result("Delete Job", False, f"Error: {str(e)}")

        # Delete customer (last)
        try:
            response = requests.delete(f"{self.base_url}/customers/{self.test_customer_id}", 
                                     headers=self.headers, timeout=10)
            if response.status_code == 200:
                self.log_result("Delete Customer", True, "Customer deleted successfully")
            else:
                self.log_result("Delete Customer", False, f"Status: {response.status_code}", response.text)
        except Exception as e:
            self.log_result("Delete Customer", False, f"Error: {str(e)}")

    def run_all_tests(self):
        """Run comprehensive test suite"""
        print("🚢 Starting Boat Repair API Comprehensive Testing")
        print("=" * 60)
        print(f"Testing API at: {self.base_url}")
        print("=" * 60)
        
        # Test sequence
        if not self.test_api_health():
            print("❌ API Health check failed. Stopping tests.")
            return False
            
        self.test_create_customer()
        self.test_get_customers()
        self.test_get_specific_customer()
        self.test_update_customer()
        self.test_add_image()
        self.test_add_job()
        self.test_update_job_status()
        self.test_add_note()
        self.test_error_handling()
        self.test_delete_operations()
        
        # Summary
        print("=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for r in self.results if "✅ PASS" in r["status"])
        failed = sum(1 for r in self.results if "❌ FAIL" in r["status"])
        total = len(self.results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {failed}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        
        if failed > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.results:
                if "❌ FAIL" in result["status"]:
                    print(f"  - {result['test']}: {result['details']}")
        
        return failed == 0

if __name__ == "__main__":
    tester = BoatRepairAPITester()
    success = tester.run_all_tests()
    
    if success:
        print("\n🎉 All tests passed! Backend API is working correctly.")
    else:
        print("\n⚠️  Some tests failed. Check the details above.")