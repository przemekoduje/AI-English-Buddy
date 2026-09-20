# -*- coding: utf-8 -*-
import unittest
from app import app

class TestLiveApiEndpoints(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_live_config(self):
        res = self.client.get("/api/live/config")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn("default_provider", data)
        self.assertIn("voices", data)
        self.assertIn("models", data)
        self.assertTrue(len(data["voices"]) >= 5)
        print("PASS: /api/live/config works:", data["default_provider"], len(data["voices"]), "voices")

    def test_live_token_unauthorized(self):
        res = self.client.get("/api/live/token")
        self.assertEqual(res.status_code, 401)
        print("PASS: /api/live/token correctly protects unauthorized requests (401)")

    def test_vertex_token_unauthorized(self):
        res = self.client.get("/api/live/vertex-token")
        self.assertEqual(res.status_code, 401)
        print("PASS: /api/live/vertex-token correctly protects unauthorized requests (401)")

if __name__ == "__main__":
    unittest.main()
