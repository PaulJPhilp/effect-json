// Golden test fixture for configuration files
// Focus: JSONC parsing with comments (real-world config patterns)

export default {
  database_config: {
    data: {
      // Database connection settings
      host: "localhost",
      port: 5432,
      /* Authentication */
      username: "admin",
      password: "secret",
      // Connection pool
      pool: {
        min: 2,
        max: 10,
      },
    },
    __metadata: {
      description: "Database configuration with comments",
      should_parse: true,
      should_validate: true,
      round_trip: true,
      backends: ["jsonc"],
      note: "Comments provide context for configuration values",
    },
  },

  api_config: {
    data: {
      // API server configuration
      port: 3000,
      host: "0.0.0.0",

      /* Rate limiting settings
         Prevents abuse and ensures fair usage */
      rateLimit: {
        windowMs: 900000, // 15 minutes
        maxRequests: 100, // Limit each IP to 100 requests per windowMs
      },

      // CORS settings
      cors: {
        origins: ["http://localhost:3000", "https://example.com"],
        credentials: true,
      },
    },
    __metadata: {
      description: "API server config with inline and block comments",
      should_parse: true,
      should_validate: true,
      round_trip: true,
      backends: ["jsonc"],
    },
  },

  feature_flags: {
    data: {
      // Feature flags for staged rollout
      features: {
        newDashboard: true, // Enabled for all users
        betaFeatures: false, // Disabled pending QA
        experimentalApi: false, // Dev only
      },

      /* Environment-specific overrides
         These override the defaults above */
      overrides: {
        development: {
          betaFeatures: true,
          experimentalApi: true,
        },
      },
    },
    __metadata: {
      description: "Feature flags with explanatory comments",
      should_parse: true,
      should_validate: true,
      round_trip: true,
      backends: ["jsonc"],
    },
  },

  nested_comments: {
    data: {
      // Top-level comment
      service: {
        // Nested comment
        name: "effect-json",
        /* Multi-line nested
           comment block */
        version: "1.0.0",
      },
    },
    __metadata: {
      description: "Config with nested comments at multiple levels",
      should_parse: true,
      should_validate: true,
      round_trip: true,
      backends: ["jsonc"],
    },
  },

  trailing_commas: {
    raw_input: '{\n  "key1": "value1",\n  "key2": "value2",\n}',
    __metadata: {
      description: "JSONC with trailing comma (not supported by standard JSON)",
      should_parse: false,
      expected_error: "ParseError",
      backends: ["json", "jsonc"],
      note: "Our JSONC strips comments but doesn't add trailing comma support",
    },
  },

  comment_in_string: {
    data: {
      message: "This is // not a comment",
      description: "Neither /* is this */",
    },
    __metadata: {
      description: "Comments inside strings should be preserved",
      should_parse: true,
      should_validate: true,
      round_trip: true,
      backends: ["jsonc"],
      note: "Comment stripper must respect string boundaries",
    },
  },

  empty_config: {
    data: {},
    __metadata: {
      description: "Empty configuration object",
      should_parse: true,
      should_validate: true,
      round_trip: true,
      backends: ["json", "jsonc"],
    },
  },

  config_with_arrays: {
    data: {
      // Allowed domains for CORS
      allowedOrigins: [
        "https://app.example.com", // Production
        "https://staging.example.com", // Staging
        "http://localhost:3000", // Local dev
      ],

      /* IP whitelist for admin access */
      adminIPs: ["192.168.1.1", "10.0.0.1"],
    },
    __metadata: {
      description: "Config with commented arrays",
      should_parse: true,
      should_validate: true,
      round_trip: true,
      backends: ["jsonc"],
    },
  },
} as const;
