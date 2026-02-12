#!/usr/bin/env python3
"""Threaded HTTP server for local development."""
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler
from socketserver import ThreadingMixIn

class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8766
server = ThreadedHTTPServer(("", port), SimpleHTTPRequestHandler)
print(f"Serving on http://localhost:{port}")
server.serve_forever()
