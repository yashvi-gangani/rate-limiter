# API Gateway with Configurable Rate Limiting

## Introduction

This project is an API Gateway built using **Node.js**, **Express.js**, **TypeScript**, **Redis**, **MongoDB**, and **React**.

I built this project to understand how API gateways manage incoming requests and implement rate limiting without relying on existing middleware packages.

The project supports **Token Bucket** and **Sliding Window Counter** algorithms, API key authentication, dynamic client tiers, Redis-based rate limiting, MongoDB for storing API keys and tier information, and a React dashboard for monitoring gateway activity.

I also added Prometheus metrics, Docker support, and k6 load testing to learn how backend applications are monitored and tested under different traffic conditions.

## Why I Built This Project

I wanted to learn how API gateways work internally instead of using existing rate-limiting middleware.

While building this project, I learned how different rate-limiting algorithms work, how Redis can be used to store request data, how API keys are managed, and how monitoring tools like Prometheus can be integrated into a backend application.

Building the React dashboard also helped me understand how backend data can be visualized in real time.

## Rate Limiting Algorithms

### Token Bucket

This algorithm allows short bursts of traffic by storing tokens that refill over time. Each request consumes one token, and requests are blocked when no tokens are available.

### Sliding Window Counter

This algorithm tracks requests across time windows to provide smoother rate limiting and reduce sudden spikes at window boundaries.

## Features

### API Gateway

- API key authentication
- Dynamic client tier management
- Request forwarding
- Configurable rate limiting

### Rate Limiting

- Token Bucket Algorithm
- Sliding Window Counter Algorithm
- Redis-based request tracking
- In-memory fallback for development
- Retry-After response support

### Admin Panel

- Create API keys
- Update API keys
- Delete API keys
- Manage client tiers
- View gateway statistics

### Dashboard

- Live request monitoring
- Total requests
- Blocked requests
- Active clients
- Remaining request quota
- Gateway status

### Monitoring & Testing

- Prometheus metrics
- Health check endpoint
- Unit tests using Jest
- Load testing using k6
- Docker support

## Challenges I Faced

While building this project, I faced several challenges and learned a lot while solving them:

- Understanding how the **Token Bucket** and **Sliding Window Counter** algorithms work and implementing them from scratch.
- Storing and updating rate-limiting data efficiently using **Redis**.
- Writing **Redis Lua scripts** to perform rate-limiting operations atomically.
- Designing a flexible system for **dynamic API key and client tier management** using MongoDB.
- Keeping the **React dashboard** synchronized with live gateway statistics.
- Handling different client tiers with different request limits while keeping the code reusable.
- Setting up **Prometheus** to monitor request counts and response times.
- Creating realistic **load tests** using k6 to verify that the gateway behaved correctly under heavy traffic.
- Configuring **Docker** so that the backend, Redis, and other services could run together easily.
- Organizing the backend into separate modules to keep the project clean and easy to maintain.

## What I Learned

Working on this project helped me improve my understanding of:

- API Gateway architecture
- Express.js middleware
- TypeScript project structure
- Redis and Lua scripts
- MongoDB integration
- API key authentication
- Rate limiting algorithms
- React dashboard development
- Prometheus monitoring
- Load testing with k6
- Docker and Docker Compose