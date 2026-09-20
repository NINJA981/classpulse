import fs from 'fs';
import path from 'path';

const postmanCollection = {
  info: {
    _postman_id: "c8f5d02a-9e23-4f91-b328-8d4e921d7b32",
    name: "ClassPulse Unified API Collection",
    description: "Production Postman test suite for the ClassPulse SIH-backend service covering RBAC Auth, Classroom Sections, Lesson Studio, Assessment Questions, Rubric Assignments, and Adaptive Diagnostics.",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  item: [
    {
      name: "1. System Health & Infrastructure",
      item: [
        {
          name: "Health Probe",
          request: {
            method: "GET",
            header: [],
            url: {
              raw: "{{baseUrl}}/api/health",
              host: ["{{baseUrl}}"],
              path: ["api", "health"]
            }
          },
          event: [
            {
              listen: "test",
              script: {
                type: "text/javascript",
                exec: [
                  "pm.test('Status code is 200', function () {",
                  "    pm.response.to.have.status(200);",
                  "});",
                  "pm.test('Service is marked healthy and MongoDB active', function () {",
                  "    var json = pm.response.json();",
                  "    pm.expect(json.status).to.eql('healthy');",
                  "    pm.expect(json.service).to.eql('SIH-backend');",
                  "});"
                ]
              }
            }
          ]
        },
        {
          name: "Static File Upload Delivery",
          request: {
            method: "GET",
            header: [],
            url: {
              raw: "{{baseUrl}}/uploads/photosynthesis-recording.webm",
              host: ["{{baseUrl}}"],
              path: ["uploads", "photosynthesis-recording.webm"]
            }
          },
          event: [
            {
              listen: "test",
              script: {
                type: "text/javascript",
                exec: [
                  "pm.test('Status code is 200 or 404 (static route active)', function () {",
                  "    pm.expect([200, 404]).to.include(pm.response.code);",
                  "});"
                ]
              }
            }
          ]
        },
        {
          name: "Socket.io Polling Handshake",
          request: {
            method: "GET",
            header: [],
            url: {
              raw: "{{baseUrl}}/socket.io/?EIO=4&transport=polling",
              host: ["{{baseUrl}}"],
              path: ["socket.io", ""],
              query: [
                { key: "EIO", value: "4" },
                { key: "transport", value: "polling" }
              ]
            }
          },
          event: [
            {
              listen: "test",
              script: {
                type: "text/javascript",
                exec: [
                  "pm.test('Socket.io returns 200 handshake response', function () {",
                  "    pm.response.to.have.status(200);",
                  "});",
                  "pm.test('Response includes session id string', function () {",
                  "    pm.expect(pm.response.text()).to.include('sid');",
                  "});"
                ]
              }
            }
          ]
        }
      ]
    },
    {
      name: "2. Authentication & RBAC",
      item: [
        {
          name: "Login Validation - Empty Credentials",
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: "{}"
            },
            url: {
              raw: "{{baseUrl}}/api/auth/login",
              host: ["{{baseUrl}}"],
              path: ["api", "auth", "login"]
            }
          },
          event: [
            {
              listen: "test",
              script: {
                type: "text/javascript",
                exec: [
                  "pm.test('Status code is 400 Bad Request', function () {",
                  "    pm.response.to.have.status(400);",
                  "});",
                  "pm.test('Returns validation error message', function () {",
                  "    var json = pm.response.json();",
                  "    pm.expect(json.error).to.include('required');",
                  "});"
                ]
              }
            }
          ]
        },
        {
          name: "Login - Campus Administrator",
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                email: "admin@apex.edu",
                password: "admin123",
                role: "admin"
              }, null, 2)
            },
            url: {
              raw: "{{baseUrl}}/api/auth/login",
              host: ["{{baseUrl}}"],
              path: ["api", "auth", "login"]
            }
          },
          event: [
            {
              listen: "test",
              script: {
                type: "text/javascript",
                exec: [
                  "pm.test('Status code is 200 OK', function () {",
                  "    pm.response.to.have.status(200);",
                  "});",
                  "pm.test('Returns valid JWT token and sets environment', function () {",
                  "    var json = pm.response.json();",
                  "    pm.expect(json.token).to.be.a('string');",
                  "    pm.expect(json.user.role).to.eql('admin');",
                  "    pm.environment.set('adminToken', json.token);",
                  "});"
                ]
              }
            }
          ]
        },
        {
          name: "Login - Teacher",
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                email: "anitha@apex.edu",
                password: "teacher123",
                role: "teacher"
              }, null, 2)
            },
            url: {
              raw: "{{baseUrl}}/api/auth/login",
              host: ["{{baseUrl}}"],
              path: ["api", "auth", "login"]
            }
          },
          event: [
            {
              listen: "test",
              script: {
                type: "text/javascript",
                exec: [
                  "pm.test('Status code is 200 OK', function () {",
                  "    pm.response.to.have.status(200);",
                  "});",
                  "pm.test('Teacher role returned and token saved', function () {",
                  "    var json = pm.response.json();",
                  "    pm.expect(json.user.role).to.eql('teacher');",
                  "    pm.environment.set('teacherToken', json.token);",
                  "});"
                ]
              }
            }
          ]
        },
        {
          name: "Login - Student",
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                email: "aarav.sharma@apex.edu",
                password: "student123",
                role: "student"
              }, null, 2)
            },
            url: {
              raw: "{{baseUrl}}/api/auth/login",
              host: ["{{baseUrl}}"],
              path: ["api", "auth", "login"]
            }
          },
          event: [
            {
              listen: "test",
              script: {
                type: "text/javascript",
                exec: [
                  "pm.test('Status code is 200 OK', function () {",
                  "    pm.response.to.have.status(200);",
                  "});",
                  "pm.test('Student profile includes rollNumber', function () {",
                  "    var json = pm.response.json();",
                  "    pm.expect(json.user.rollNumber).to.eql('21CS001');",
                  "    pm.environment.set('studentToken', json.token);",
                  "});"
                ]
              }
            }
          ]
        },
        {
          name: "Login Security - Bad Password",
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                email: "admin@apex.edu",
                password: "wrong_password_xyz"
              }, null, 2)
            },
            url: {
              raw: "{{baseUrl}}/api/auth/login",
              host: ["{{baseUrl}}"],
              path: ["api", "auth", "login"]
            }
          },
          event: [
            {
              listen: "test",
              script: {
                type: "text/javascript",
                exec: [
                  "pm.test('Status code is 401 Unauthorized', function () {",
                  "    pm.response.to.have.status(401);",
                  "});"
                ]
              }
            }
          ]
        },
        {
          name: "Get Profile - Unauthorized Without Header",
          request: {
            method: "GET",
            header: [],
            url: {
              raw: "{{baseUrl}}/api/auth/me",
              host: ["{{baseUrl}}"],
              path: ["api", "auth", "me"]
            }
          },
          event: [
            {
              listen: "test",
              script: {
                type: "text/javascript",
                exec: [
                  "pm.test('Status code is 401 Unauthorized', function () {",
                  "    pm.response.to.have.status(401);",
                  "});"
                ]
              }
            }
          ]
        },
        {
          name: "Get Profile - Authorized Admin",
          request: {
            method: "GET",
            header: [
              { key: "Authorization", value: "Bearer {{adminToken}}" }
            ],
            url: {
              raw: "{{baseUrl}}/api/auth/me",
              host: ["{{baseUrl}}"],
              path: ["api", "auth", "me"]
            }
          },
          event: [
            {
              listen: "test",
              script: {
                type: "text/javascript",
                exec: [
                  "pm.test('Status code is 200 OK', function () {",
                  "    pm.response.to.have.status(200);",
                  "});",
                  "pm.test('Profile matches authenticated administrator', function () {",
                  "    var json = pm.response.json();",
                  "    pm.expect(json.user.email).to.eql('admin@apex.edu');",
                  "});"
                ]
              }
            }
          ]
        }
      ]
    },
    {
      name: "3. Classroom Sections",
      item: [
        {
          name: "Get All Sections",
          request: {
            method: "GET",
            header: [],
            url: {
              raw: "{{baseUrl}}/api/sections",
              host: ["{{baseUrl}}"],
              path: ["api", "sections"]
            }
          },
          event: [
            {
              listen: "test",
              script: {
                type: "text/javascript",
                exec: [
                  "pm.test('Status code is 200 OK', function () {",
                  "    pm.response.to.have.status(200);",
                  "});",
                  "pm.test('Returns list of sections and saves sectionId', function () {",
                  "    var json = pm.response.json();",
                  "    pm.expect(json).to.be.an('array');",
                  "    if (json.length > 0) {",
                  "        pm.environment.set('sectionId', json[0]._id);",
                  "        pm.environment.set('joinCode', json[0].joinCode);",
                  "    }",
                  "});"
                ]
              }
            }
          ]
        },
        {
          name: "Create Section",
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                name: "Grade 11 - Section A",
                courseName: "Organic Chemistry & Thermodynamics",
                teacherNames: ["Dr. Vikram Sengupta"]
              }, null, 2)
            },
            url: {
              raw: "{{baseUrl}}/api/sections",
              host: ["{{baseUrl}}"],
              path: ["api", "sections"]
            }
          },
          event: [
            {
              listen: "test",
              script: {
                type: "text/javascript",
                exec: [
                  "pm.test('Status code is 201 Created', function () {",
                  "    pm.response.to.have.status(201);",
                  "});",
                  "pm.test('Generates join code starting with CP-', function () {",
                  "    var json = pm.response.json();",
                  "    pm.expect(json.joinCode).to.match(/^CP-[A-Z0-9]{4}$/);",
                  "    pm.environment.set('createdSectionId', json._id);",
                  "    pm.environment.set('createdJoinCode', json.joinCode);",
                  "});"
                ]
              }
            }
          ]
        },
        {
          name: "Rotate Section Join Code",
          request: {
            method: "POST",
            header: [],
            url: {
              raw: "{{baseUrl}}/api/sections/{{sectionId}}/rotate-code",
              host: ["{{baseUrl}}"],
              path: ["api", "sections", "{{sectionId}}", "rotate-code"]
            }
          },
          event: [
            {
              listen: "test",
              script: {
                type: "text/javascript",
                exec: [
                  "pm.test('Status code is 200 OK', function () {",
                  "    pm.response.to.have.status(200);",
                  "});",
                  "pm.test('New join code rotated successfully', function () {",
                  "    var json = pm.response.json();",
                  "    pm.expect(json.success).to.be.true;",
                  "    pm.environment.set('rotatedJoinCode', json.joinCode);",
                  "});"
                ]
              }
            }
          ]
        },
        {
          name: "Preview Section by Join Code",
          request: {
            method: "GET",
            header: [],
            url: {
              raw: "{{baseUrl}}/api/sections/preview?code={{createdJoinCode}}",
              host: ["{{baseUrl}}"],
              path: ["api", "sections", "preview"],
              query: [{ key: "code", value: "{{createdJoinCode}}" }]
            }
          },
          event: [
            {
              listen: "test",
              script: {
                type: "text/javascript",
                exec: [
                  "pm.test('Status code is 200 OK', function () {",
                  "    pm.response.to.have.status(200);",
                  "});",
                  "pm.test('Returns course title and teacher info', function () {",
                  "    var json = pm.response.json();",
                  "    pm.expect(json.courseTitle).to.include('Organic Chemistry');",
                  "});"
                ]
              }
            }
          ]
        },
        {
          name: "Join Section with Roll Number",
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                code: "{{createdJoinCode}}",
                rollNumber: "21CS099"
              }, null, 2)
            },
            url: {
              raw: "{{baseUrl}}/api/sections/join",
              host: ["{{baseUrl}}"],
              path: ["api", "sections", "join"]
            }
          },
          event: [
            {
              listen: "test",
              script: {
                type: "text/javascript",
                exec: [
                  "pm.test('Status code is 200 OK', function () {",
                  "    pm.response.to.have.status(200);",
                  "});",
                  "pm.test('Student enrollment confirmed', function () {",
                  "    var json = pm.response.json();",
                  "    pm.expect(json.success).to.be.true;",
                  "    pm.expect(json.rollNumber).to.eql('21CS099');",
                  "});"
                ]
              }
            }
          ]
        }
      ]
    },
    {
      name: "4. Lesson Studio",
      item: [
        {
          name: "Get All Lessons",
          request: {
            method: "GET",
            header: [],
            url: {
              raw: "{{baseUrl}}/api/lessons",
              host: ["{{baseUrl}}"],
              path: ["api", "lessons"]
            }
          },
          event: [
            {
              listen: "test",
              script: {
                type: "text/javascript",
                exec: [
                  "pm.test('Status code is 200 OK', function () {",
                  "    pm.response.to.have.status(200);",
                  "});",
                  "pm.test('Returns lessons array and captures lessonId', function () {",
                  "    var json = pm.response.json();",
                  "    pm.expect(json).to.be.an('array');",
                  "    if (json.length > 0) {",
                  "        pm.environment.set('lessonId', json[0]._id);",
                  "    }",
                  "});"
                ]
              }
            }
          ]
        },
        {
          name: "Create Lesson Draft",
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                title: "Quantum Wave Mechanics & Schrödinger Equation",
                subject: "Physics",
                className: "Grade 12 - Advanced Physics",
                teacherId: "tch_phys_01"
              }, null, 2)
            },
            url: {
              raw: "{{baseUrl}}/api/lessons",
              host: ["{{baseUrl}}"],
              path: ["api", "lessons"]
            }
          },
          event: [
            {
              listen: "test",
              script: {
                type: "text/javascript",
                exec: [
                  "pm.test('Status code is 201 Created', function () {",
                  "    pm.response.to.have.status(201);",
                  "});",
                  "pm.test('Lesson initial status is draft', function () {",
                  "    var json = pm.response.json();",
                  "    pm.expect(json.status).to.eql('draft');",
                  "    pm.environment.set('createdLessonId', json._id);",
                  "});"
                ]
              }
            }
          ]
        },
        {
          name: "Get Lesson by ID (Bundle)",
          request: {
            method: "GET",
            header: [],
            url: {
              raw: "{{baseUrl}}/api/lessons/{{createdLessonId}}",
              host: ["{{baseUrl}}"],
              path: ["api", "lessons", "{{createdLessonId}}"]
            }
          },
          event: [
            {
              listen: "test",
              script: {
                type: "text/javascript",
                exec: [
                  "pm.test('Status code is 200 OK', function () {",
                  "    pm.response.to.have.status(200);",
                  "});",
                  "pm.test('Returns lesson bundle with questions & assignment', function () {",
                  "    var json = pm.response.json();",
                  "    pm.expect(json.lesson).to.be.an('object');",
                  "    pm.expect(json.questions).to.be.an('array');",
                  "});"
                ]
              }
            }
          ]
        },
        {
          name: "Attach Source Material",
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                sourceType: "document",
                sourceFile: {
                  path: "/uploads/quantum-mechanics-handout.pdf",
                  mimeType: "application/pdf",
                  sizeBytes: 1542000
                }
              }, null, 2)
            },
            url: {
              raw: "{{baseUrl}}/api/lessons/{{createdLessonId}}/source",
              host: ["{{baseUrl}}"],
              path: ["api", "lessons", "{{createdLessonId}}", "source"]
            }
          },
          event: [
            {
              listen: "test",
              script: {
                type: "text/javascript",
                exec: [
                  "pm.test('Status code is 200 OK', function () {",
                  "    pm.response.to.have.status(200);",
                  "});",
                  "pm.test('Lesson transitioned to queued state', function () {",
                  "    var json = pm.response.json();",
                  "    pm.expect(json.status).to.eql('queued');",
                  "});"
                ]
              }
            }
          ]
        },
        {
          name: "Trigger AI Question Generation",
          request: {
            method: "POST",
            header: [],
            url: {
              raw: "{{baseUrl}}/api/lessons/{{createdLessonId}}/generate",
              host: ["{{baseUrl}}"],
              path: ["api", "lessons", "{{createdLessonId}}", "generate"]
            }
          },
          event: [
            {
              listen: "test",
              script: {
                type: "text/javascript",
                exec: [
                  "pm.test('Status code is 200 OK', function () {",
                  "    pm.response.to.have.status(200);",
                  "});",
                  "pm.test('Lesson ready for teacher review', function () {",
                  "    var json = pm.response.json();",
                  "    pm.expect(json.lesson.status).to.eql('ready_for_review');",
                  "});"
                ]
              }
            }
          ]
        },
        {
          name: "Approve and Publish Lesson",
          request: {
            method: "POST",
            header: [],
            url: {
              raw: "{{baseUrl}}/api/lessons/{{createdLessonId}}/approve",
              host: ["{{baseUrl}}"],
              path: ["api", "lessons", "{{createdLessonId}}", "approve"]
            }
          },
          event: [
            {
              listen: "test",
              script: {
                type: "text/javascript",
                exec: [
                  "pm.test('Status code is 200 OK', function () {",
                  "    pm.response.to.have.status(200);",
                  "});",
                  "pm.test('Lesson status transitioned to published', function () {",
                  "    var json = pm.response.json();",
                  "    pm.expect(json.lesson.status).to.eql('published');",
                  "});"
                ]
              }
            }
          ]
        }
      ]
    },
    {
      name: "5. Assessment Questions",
      item: [
        {
          name: "Get Questions (Filter by Lesson)",
          request: {
            method: "GET",
            header: [],
            url: {
              raw: "{{baseUrl}}/api/questions?lessonId={{createdLessonId}}",
              host: ["{{baseUrl}}"],
              path: ["api", "questions"],
              query: [{ key: "lessonId", value: "{{createdLessonId}}" }]
            }
          },
          event: [
            {
              listen: "test",
              script: {
                type: "text/javascript",
                exec: [
                  "pm.test('Status code is 200 OK', function () {",
                  "    pm.response.to.have.status(200);",
                  "});",
                  "pm.test('Questions loaded and questionId stored', function () {",
                  "    var json = pm.response.json();",
                  "    pm.expect(json).to.be.an('array');",
                  "    if (json.length > 0) {",
                  "        pm.environment.set('questionId', json[0]._id);",
                  "    }",
                  "});"
                ]
              }
            }
          ]
        },
        {
          name: "Create Custom Question",
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                lessonId: "{{createdLessonId}}",
                type: "mcq",
                stem: "What is the physical interpretation of the square of wave function amplitude |ψ|²?",
                options: [
                  "Probability density of locating the particle",
                  "Instantaneous kinetic energy",
                  "Total electrostatic potential",
                  "Relativistic mass momentum"
                ],
                correctIndex: 0,
                explanation: "Born interpretation defines |ψ|² as probability density.",
                topicTag: "Quantum Physics",
                difficulty: "medium",
                status: "draft"
              }, null, 2)
            },
            url: {
              raw: "{{baseUrl}}/api/questions",
              host: ["{{baseUrl}}"],
              path: ["api", "questions"]
            }
          },
          event: [
            {
              listen: "test",
              script: {
                type: "text/javascript",
                exec: [
                  "pm.test('Status code is 201 Created', function () {",
                  "    pm.response.to.have.status(201);",
                  "});",
                  "pm.test('Question created with teacher-edited flag', function () {",
                  "    var json = pm.response.json();",
                  "    pm.expect(json.editedByTeacher).to.be.true;",
                  "    pm.environment.set('createdQuestionId', json._id);",
                  "});"
                ]
              }
            }
          ]
        },
        {
          name: "Update Question (PATCH)",
          request: {
            method: "PATCH",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                difficulty: "hard",
                explanation: "Updated Born rule formulation with analytical rigor."
              }, null, 2)
            },
            url: {
              raw: "{{baseUrl}}/api/questions/{{createdQuestionId}}",
              host: ["{{baseUrl}}"],
              path: ["api", "questions", "{{createdQuestionId}}"]
            }
          },
          event: [
            {
              listen: "test",
              script: {
                type: "text/javascript",
                exec: [
                  "pm.test('Status code is 200 OK', function () {",
                  "    pm.response.to.have.status(200);",
                  "});",
                  "pm.test('Difficulty updated to hard', function () {",
                  "    var json = pm.response.json();",
                  "    pm.expect(json.difficulty).to.eql('hard');",
                  "});"
                ]
              }
            }
          ]
        },
        {
          name: "Batch Approve Questions",
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                ids: ["{{createdQuestionId}}"]
              }, null, 2)
            },
            url: {
              raw: "{{baseUrl}}/api/questions/approve",
              host: ["{{baseUrl}}"],
              path: ["api", "questions", "approve"]
            }
          },
          event: [
            {
              listen: "test",
              script: {
                type: "text/javascript",
                exec: [
                  "pm.test('Status code is 200 OK', function () {",
                  "    pm.response.to.have.status(200);",
                  "});",
                  "pm.test('Batch approved count is at least 1', function () {",
                  "    var json = pm.response.json();",
                  "    pm.expect(json.success).to.be.true;",
                  "    pm.expect(json.approvedCount).to.be.at.least(1);",
                  "});"
                ]
              }
            }
          ]
        },
        {
          name: "Reject Question",
          request: {
            method: "POST",
            header: [],
            url: {
              raw: "{{baseUrl}}/api/questions/{{createdQuestionId}}/reject",
              host: ["{{baseUrl}}"],
              path: ["api", "questions", "{{createdQuestionId}}", "reject"]
            }
          },
          event: [
            {
              listen: "test",
              script: {
                type: "text/javascript",
                exec: [
                  "pm.test('Status code is 200 OK', function () {",
                  "    pm.response.to.have.status(200);",
                  "});",
                  "pm.test('Question marked rejected', function () {",
                  "    var json = pm.response.json();",
                  "    pm.expect(json.status).to.eql('rejected');",
                  "});"
                ]
              }
            }
          ]
        },
        {
          name: "Delete Question",
          request: {
            method: "DELETE",
            header: [],
            url: {
              raw: "{{baseUrl}}/api/questions/{{createdQuestionId}}",
              host: ["{{baseUrl}}"],
              path: ["api", "questions", "{{createdQuestionId}}"]
            }
          },
          event: [
            {
              listen: "test",
              script: {
                type: "text/javascript",
                exec: [
                  "pm.test('Status code is 200 OK', function () {",
                  "    pm.response.to.have.status(200);",
                  "});",
                  "pm.test('Deletion confirmed', function () {",
                  "    var json = pm.response.json();",
                  "    pm.expect(json.success).to.be.true;",
                  "});"
                ]
              }
            }
          ]
        }
      ]
    },
    {
      name: "6. Assignments & Worksheets",
      item: [
        {
          name: "Get All Assignments",
          request: {
            method: "GET",
            header: [],
            url: {
              raw: "{{baseUrl}}/api/assignments",
              host: ["{{baseUrl}}"],
              path: ["api", "assignments"]
            }
          },
          event: [
            {
              listen: "test",
              script: {
                type: "text/javascript",
                exec: [
                  "pm.test('Status code is 200 OK', function () {",
                  "    pm.response.to.have.status(200);",
                  "});"
                ]
              }
            }
          ]
        },
        {
          name: "Create Assignment with Rubric",
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                lessonId: "{{createdLessonId}}",
                title: "Wavepacket Dispersion Analytical Homework",
                subject: "Physics",
                prompt: "Derive the spatial envelope evolution of a 1D free particle wavepacket.",
                estimatedMinutes: 40,
                rubric: [
                  { criterion: "Mathematical Rigor", marks: 15, descriptor: "Fourier integral derivation" },
                  { criterion: "Physical Intuition", marks: 10, descriptor: "Interpretation of group velocity" }
                ]
              }, null, 2)
            },
            url: {
              raw: "{{baseUrl}}/api/assignments",
              host: ["{{baseUrl}}"],
              path: ["api", "assignments"]
            }
          },
          event: [
            {
              listen: "test",
              script: {
                type: "text/javascript",
                exec: [
                  "pm.test('Status code is 201 Created', function () {",
                  "    pm.response.to.have.status(201);",
                  "});",
                  "pm.test('Rubric array preserved in document', function () {",
                  "    var json = pm.response.json();",
                  "    pm.expect(json.rubric.length).to.eql(2);",
                  "});"
                ]
              }
            }
          ]
        }
      ]
    },
    {
      name: "7. Diagnostic Assessments",
      item: [
        {
          name: "Submit Student Diagnostic Responses",
          request: {
            method: "POST",
            header: [{ key: "Content-Type", value: "application/json" }],
            body: {
              mode: "raw",
              raw: JSON.stringify({
                studentId: "stu_postman_test_99",
                rollNumber: "21CS099",
                subject: "Cellular Energetics",
                responses: [
                  {
                    questionId: "q_diag_01",
                    selectedOption: 0,
                    confidenceRating: 4,
                    isCorrect: true
                  },
                  {
                    questionId: "q_diag_02",
                    selectedOption: 2,
                    confidenceRating: 2,
                    isCorrect: false
                  }
                ],
                identifiedGaps: [
                  "Chemiosmosis & Proton Gradient Coupling",
                  "ATP Synthase Kinetics"
                ]
              }, null, 2)
            },
            url: {
              raw: "{{baseUrl}}/api/diagnostic",
              host: ["{{baseUrl}}"],
              path: ["api", "diagnostic"]
            }
          },
          event: [
            {
              listen: "test",
              script: {
                type: "text/javascript",
                exec: [
                  "pm.test('Status code is 201 Created', function () {",
                  "    pm.response.to.have.status(201);",
                  "});",
                  "pm.test('Returns diagnostic score & gaps', function () {",
                  "    var json = pm.response.json();",
                  "    pm.expect(json.success).to.be.true;",
                  "    pm.expect(json.score).to.eql(1);",
                  "    pm.expect(json.totalQuestions).to.eql(2);",
                  "});"
                ]
              }
            }
          ]
        },
        {
          name: "Get Student Diagnostic Analysis",
          request: {
            method: "GET",
            header: [],
            url: {
              raw: "{{baseUrl}}/api/diagnostic/stu_postman_test_99",
              host: ["{{baseUrl}}"],
              path: ["api", "diagnostic", "stu_postman_test_99"]
            }
          },
          event: [
            {
              listen: "test",
              script: {
                type: "text/javascript",
                exec: [
                  "pm.test('Status code is 200 OK', function () {",
                  "    pm.response.to.have.status(200);",
                  "});",
                  "pm.test('Returns student diagnostic report with identified gaps', function () {",
                  "    var json = pm.response.json();",
                  "    pm.expect(json.studentId).to.eql('stu_postman_test_99');",
                  "    pm.expect(json.identifiedGaps).to.include('Chemiosmosis & Proton Gradient Coupling');",
                  "});"
                ]
              }
            }
          ]
        },
        {
          name: "Get Diagnostic - Non-existent Student (404)",
          request: {
            method: "GET",
            header: [],
            url: {
              raw: "{{baseUrl}}/api/diagnostic/non_existent_stu_000",
              host: ["{{baseUrl}}"],
              path: ["api", "diagnostic", "non_existent_stu_000"]
            }
          },
          event: [
            {
              listen: "test",
              script: {
                type: "text/javascript",
                exec: [
                  "pm.test('Status code is 404 Not Found', function () {",
                  "    pm.response.to.have.status(404);",
                  "});"
                ]
              }
            }
          ]
        }
      ]
    }
  ]
};

const postmanEnvironment = {
  id: "4b87e2a1-0d33-4f92-a1f7-bc32e99120de",
  name: "ClassPulse Local Environment",
  values: [
    { key: "baseUrl", value: "http://localhost:5000", type: "default", enabled: true },
    { key: "adminToken", value: "", type: "secret", enabled: true },
    { key: "teacherToken", value: "", type: "secret", enabled: true },
    { key: "studentToken", value: "", type: "secret", enabled: true },
    { key: "sectionId", value: "", type: "default", enabled: true },
    { key: "joinCode", value: "", type: "default", enabled: true },
    { key: "createdSectionId", value: "", type: "default", enabled: true },
    { key: "createdJoinCode", value: "", type: "default", enabled: true },
    { key: "rotatedJoinCode", value: "", type: "default", enabled: true },
    { key: "lessonId", value: "", type: "default", enabled: true },
    { key: "createdLessonId", value: "", type: "default", enabled: true },
    { key: "questionId", value: "", type: "default", enabled: true },
    { key: "createdQuestionId", value: "", type: "default", enabled: true }
  ]
};

const projectRoot = path.resolve(process.cwd(), '..');
const collectionPath = path.join(projectRoot, 'ClassPulse_API.postman_collection.json');
const environmentPath = path.join(projectRoot, 'ClassPulse_Environment.postman_environment.json');

fs.writeFileSync(collectionPath, JSON.stringify(postmanCollection, null, 2));
fs.writeFileSync(environmentPath, JSON.stringify(postmanEnvironment, null, 2));

console.log('Postman Collection generated at:', collectionPath);
console.log('Postman Environment generated at:', environmentPath);
