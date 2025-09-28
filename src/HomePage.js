import React, { useState, useEffect, useCallback, useRef } from 'react';

function HomePage() {
  // State Management
  const [paymentSession, setPaymentSession] = useState(null);
  const [isCheckoutReady, setIsCheckoutReady] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [scriptKey, setScriptKey] = useState(0);
  const [showEmbeddedCheckout, setShowEmbeddedCheckout] = useState(false);
  const [showConfigForm, setShowConfigForm] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('checking');
  const [lastSessionId, setLastSessionId] = useState(null);
  const embedTargetRef = useRef(null);
  
  // Application configuration - no environment variables
  const API_BASE_URL = 'https://hco-configurable-embedded-backend.vercel.app';
  const DEBUG_MODE = true;
  const ENABLE_CONSOLE_LOGS = true;
  const ENABLE_ADVANCED_MODE = true;
  const ENABLE_CONFIG_SAVE = true;
  const API_TIMEOUT = 30000;
  
  // Helper function for conditional logging
  const debugLog = useCallback((...args) => {
    if (ENABLE_CONSOLE_LOGS && DEBUG_MODE) {
      console.log('[DEBUG]', ...args);
    }
  }, [ENABLE_CONSOLE_LOGS, DEBUG_MODE]);

  // Configuration for API credentials with hardcoded defaults
  const [config, setConfig] = useState({
    merchantId: 'TESTMIDtesting00',
    username: 'merchant.TESTMIDtesting00',
    password: '9233298fcaa1c01f578759954343aca1',
    apiBaseUrl: 'https://mtf.gateway.mastercard.com',
    apiVersion: '73'
  });

  // Order configuration with hardcoded defaults
  const [orderConfig, setOrderConfig] = useState({
    currency: 'USD',
    amount: '99.00',
    description: 'Goods and Services',
    merchantName: 'JK Enterprises LLC',
    merchantUrl: 'https://microsoft.com/',
    returnUrl: `${window.location.origin}/ReceiptPage`
  });

  const [useAdvancedMode, setUseAdvancedMode] = useState(false);
  const [showApiTest, setShowApiTest] = useState(false);

  // JSON payload for advanced mode with hardcoded defaults
  const [jsonPayload, setJsonPayload] = useState(`{
  "apiOperation": "INITIATE_CHECKOUT",
  "checkoutMode": "WEBSITE",
  "interaction": {
    "operation": "PURCHASE",
    "merchant": { 
      "name": "JK Enterprises LLC",
      "url": "https://microsoft.com/"
    },
    "returnUrl": "${window.location.origin}/ReceiptPage"
  },
  "order": {
    "currency": "USD",
    "amount": "99.00",
    "id": "ORDER_PLACEHOLDER",
    "description": "Goods and Services"
  }
}`);

  const [jsonError, setJsonError] = useState(null);

  // Connection check on component mount
  useEffect(() => {
    checkConnection();
  }, []);

  // Connection check function
  const checkConnection = async () => {
    try {
      setConnectionStatus('checking');
      const response = await fetch(`${API_BASE_URL}/health`, {
        method: 'GET',
        timeout: 5000
      });
      
      if (response.ok) {
        const data = await response.json();
        setConnectionStatus('connected');
        debugLog('Backend connection successful:', data);
      } else {
        setConnectionStatus('error');
      }
    } catch (error) {
      setConnectionStatus('error');
      debugLog('Backend connection failed:', error);
    }
  };

  // Load/reload Mastercard Checkout script
  useEffect(() => {
    const loadCheckoutScript = () => {
      const existingScript = document.querySelector('script[src*="checkout.min.js"]');
      if (existingScript) {
        existingScript.remove();
        delete window.Checkout;
      }

      const script = document.createElement('script');
      script.src = `${config.apiBaseUrl}/static/checkout/checkout.min.js`;
      script.async = true;
      script.onload = () => {
        debugLog('Checkout script loaded successfully');
        setIsCheckoutReady(true);
      };
      script.onerror = () => {
        console.error('Failed to load checkout script');
        setError('Failed to load payment system. Please check your API Base URL and try again.');
        setIsCheckoutReady(false);
      };
      document.head.appendChild(script);

      return () => {
        if (document.head.contains(script)) {
          document.head.removeChild(script);
        }
      };
    };

    const cleanup = loadCheckoutScript();
    return cleanup;
  }, [scriptKey, config.apiBaseUrl]);

  // Configure checkout when script is loaded and session is available
  useEffect(() => {
    if (isCheckoutReady && window.Checkout && paymentSession) {
      debugLog('Configuring checkout with session:', paymentSession);
      
      try {
        setTimeout(() => {
          const configObj = {
            session: {
              id: paymentSession
            },
            interaction: {
              displayControl: {
                billingAddress: 'OPTIONAL',
                customerEmail: 'OPTIONAL',
                orderSummary: 'SHOW',
                shipping: 'HIDE'
              }
            }
          };
          
          debugLog('Configuration object:', configObj);
          window.Checkout.configure(configObj);
          debugLog('Configuration completed successfully');
        }, 100);
        
      } catch (configError) {
        console.error('Error configuring checkout:', configError);
        setError('Failed to configure payment system: ' + configError.message);
      }
    }
  }, [isCheckoutReady, paymentSession]);

  // Save configuration to localStorage if enabled
  const saveConfigToStorage = useCallback((newConfig, newOrderConfig) => {
    if (ENABLE_CONFIG_SAVE) {
      try {
        localStorage.setItem('mastercardConfig', JSON.stringify(newConfig));
        localStorage.setItem('mastercardOrderConfig', JSON.stringify(newOrderConfig));
        localStorage.setItem('mastercardConfigTimestamp', Date.now().toString());
        debugLog('Configuration saved to localStorage');
        setSuccess('Configuration saved successfully!');
        setTimeout(() => setSuccess(null), 3000);
      } catch (e) {
        debugLog('Failed to save configuration:', e);
      }
    }
  }, [ENABLE_CONFIG_SAVE, debugLog]);

  // Load configuration from localStorage if available
  useEffect(() => {
    if (ENABLE_CONFIG_SAVE) {
      try {
        const savedConfig = localStorage.getItem('mastercardConfig');
        const savedOrderConfig = localStorage.getItem('mastercardOrderConfig');
        const timestamp = localStorage.getItem('mastercardConfigTimestamp');
        
        // Check if saved config is not too old (24 hours)
        const isConfigFresh = timestamp && (Date.now() - parseInt(timestamp)) < (24 * 60 * 60 * 1000);
        
        if (savedConfig && isConfigFresh) {
          const parsed = JSON.parse(savedConfig);
          setConfig(prevConfig => ({ ...prevConfig, ...parsed }));
          debugLog('Loaded configuration from localStorage');
        }
        
        if (savedOrderConfig && isConfigFresh) {
          const parsed = JSON.parse(savedOrderConfig);
          setOrderConfig(prevConfig => ({ ...prevConfig, ...parsed }));
          debugLog('Loaded order configuration from localStorage');
        }
      } catch (e) {
        debugLog('Failed to load configuration from localStorage:', e);
        // Clear corrupted data
        localStorage.removeItem('mastercardConfig');
        localStorage.removeItem('mastercardOrderConfig');
        localStorage.removeItem('mastercardConfigTimestamp');
      }
    }
  }, [ENABLE_CONFIG_SAVE, debugLog]);

  // Handle config changes with automatic username generation
  const handleConfigChange = useCallback((field, value) => {
    setConfig(prev => {
      const updated = {
        ...prev,
        [field]: value
      };
      
      // Auto-generate username when merchant ID changes
      if (field === 'merchantId') {
        updated.username = `merchant.${value}`;
      }
      
      return updated;
    });
    
    // Clear errors when user makes changes
    if (error) setError(null);
  }, [error]);

  // Handle order config changes
  const handleOrderConfigChange = useCallback((field, value) => {
    setOrderConfig(prev => {
      const updated = {
        ...prev,
        [field]: value
      };
      
      return updated;
    });
    
    // Clear errors when user makes changes
    if (error) setError(null);
  }, [error]);

  // Handle JSON payload changes with validation
  const handleJsonChange = useCallback((value) => {
    setJsonPayload(value);
    setJsonError(null);
    
    try {
      JSON.parse(value);
    } catch (e) {
      setJsonError(`Invalid JSON: ${e.message}`);
    }
  }, []);

  // Reset to hardcoded defaults
  const resetToDefaults = useCallback(() => {
    setConfig({
      merchantId: 'TESTMIDtesting00',
      username: 'merchant.TESTMIDtesting00',
      password: '9233298fcaa1c01f578759954343aca1',
      apiBaseUrl: 'https://mtf.gateway.mastercard.com',
      apiVersion: '73'
    });
    
    setOrderConfig({
      currency: 'USD',
      amount: '99.00',
      description: 'Goods and Services',
      merchantName: 'JK Enterprises LLC',
      merchantUrl: 'https://microsoft.com/',
      returnUrl: `${window.location.origin}/ReceiptPage`
    });

    // Update JSON payload
    setJsonPayload(`{
  "apiOperation": "INITIATE_CHECKOUT",
  "checkoutMode": "WEBSITE",
  "interaction": {
    "operation": "PURCHASE",
    "merchant": { 
      "name": "JK Enterprises LLC",
      "url": "https://microsoft.com/"
    },
    "returnUrl": "${window.location.origin}/ReceiptPage"
  },
  "order": {
    "currency": "USD",
    "amount": "99.00",
    "id": "ORDER_PLACEHOLDER",
    "description": "Goods and Services"
  }
}`);

    // Clear stored configuration
    if (ENABLE_CONFIG_SAVE) {
      localStorage.removeItem('mastercardConfig');
      localStorage.removeItem('mastercardOrderConfig');
      localStorage.removeItem('mastercardConfigTimestamp');
    }

    setError(null);
    setSuccess('Reset to default configuration!');
    setTimeout(() => setSuccess(null), 3000);
    debugLog('Reset to hardcoded defaults');
  }, [ENABLE_CONFIG_SAVE, debugLog]);

  // Test API connection
  const testApiConnection = async () => {
    try {
      setIsLoadingSession(true);
      setError(null);
      
      const response = await fetch(`${API_BASE_URL}/test-config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
        timeout: API_TIMEOUT
      });

      const data = await response.json();
      
      if (response.ok) {
        setSuccess('API connection test successful!');
        debugLog('API test response:', data);
      } else {
        throw new Error(data.error || 'API test failed');
      }
    } catch (error) {
      setError(`API Test Failed: ${error.message}`);
    } finally {
      setIsLoadingSession(false);
      setTimeout(() => setSuccess(null), 5000);
    }
  };

  // Generate order ID and update JSON
  const updateJsonWithOrderId = (json) => {
    const orderId = `ORDER_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return json.replace('"ORDER_PLACEHOLDER"', `"${orderId}"`);
  };

  // Validate and parse JSON payload
  const getValidatedPayload = useCallback(() => {
    if (useAdvancedMode) {
      try {
        const updatedJson = updateJsonWithOrderId(jsonPayload);
        const parsed = JSON.parse(updatedJson);
        
        // Ensure required fields are present
        if (!parsed.apiOperation) {
          throw new Error('apiOperation is required');
        }
        if (!parsed.order || !parsed.order.amount) {
          throw new Error('order.amount is required');
        }
        if (!parsed.order.currency) {
          throw new Error('order.currency is required');
        }
        
        return parsed;
      } catch (e) {
        throw new Error(`JSON Validation Error: ${e.message}`);
      }
    } else {
      // Use simple form mode
      const orderId = `ORDER_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      return {
        "apiOperation": "INITIATE_CHECKOUT",
        "checkoutMode": "WEBSITE",
        "interaction": {
          "operation": "PURCHASE",
          "merchant": { 
            "name": orderConfig.merchantName,
            "url": orderConfig.merchantUrl
          },
          "returnUrl": orderConfig.returnUrl
        },
        "order": {
          "currency": orderConfig.currency,
          "amount": orderConfig.amount,
          "id": orderId,
          "description": orderConfig.description
        }
      };
    }
  }, [useAdvancedMode, jsonPayload, orderConfig]);

  // Function to call the API
  const getSessionId = async () => {
    setIsLoadingSession(true);
    setError(null);
    
    try {
      // Validate payload
      const validatedPayload = getValidatedPayload();
      
      const requestBody = {
        ...config, // Include auth config
        ...validatedPayload // Spread the payload directly
      };

      debugLog('Sending request to:', API_BASE_URL);
      debugLog('Request body:', requestBody);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

      const response = await fetch(API_BASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorMessage;
        try {
          const errorData = await response.json();
          errorMessage = errorData.details || errorData.error || `HTTP ${response.status}`;
          debugLog('API Error Details:', errorData);
        } catch {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      debugLog('Response received:', data);
      
      if (data.sessionId) {
        setLastSessionId(data.sessionId);
        return data.sessionId;
      } else if (typeof data === 'string') {
        setLastSessionId(data);
        return data; // Fallback for direct session ID response
      } else {
        throw new Error('Invalid response format: missing sessionId');
      }
      
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - please check your connection and try again');
      }
      console.error('Error fetching session ID:', error);
      setError(error.message);
      throw error;
    } finally {
      setIsLoadingSession(false);
    }
  };

  const openCheckoutPage = async () => {
    try {
      // Validate payload
      getValidatedPayload(); // This will throw if invalid

      // Save current configuration
      saveConfigToStorage(config, orderConfig);

      // Hide configuration form
      setShowConfigForm(false);
      
      // Clear previous state
      debugLog('Clearing all previous checkout state...');
      setPaymentSession(null);
      setError(null);
      setIsCheckoutReady(false);
      setShowEmbeddedCheckout(false);
      
      // Clear sessionStorage
      if (typeof(Storage) !== "undefined") {
        sessionStorage.clear();
      }
      
      // Force script reload
      setScriptKey(prev => prev + 1);
      
      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Get new session ID
      const sessionId = await getSessionId();
      
      // Set the new session ID
      const trimmedSessionId = sessionId.trim();
      debugLog('Setting NEW session ID:', trimmedSessionId);
      setPaymentSession(trimmedSessionId);
      
      // Wait for configuration to complete, then show embedded payment page
      setTimeout(() => {
        if (window.Checkout && isCheckoutReady) {
          try {
            debugLog('About to call showEmbeddedPage with session:', trimmedSessionId);
            
            // Show the embedded checkout container
            setShowEmbeddedCheckout(true);
            
            // Wait for DOM update, then embed checkout
            setTimeout(() => {
              if (embedTargetRef.current) {
                window.Checkout.showEmbeddedPage('#embed-target');
                debugLog('Embedded payment page displayed successfully');
              }
            }, 200);
            
          } catch (showError) {
            console.error('Exception showing embedded payment page:', showError);
            setError('Failed to display payment page: ' + showError.message);
            setShowConfigForm(true);
          }
        } else {
          setError('Checkout system not ready. Please try again.');
          setShowConfigForm(true);
        }
      }, 800);
      
    } catch (error) {
      console.error('Failed to open checkout page:', error);
      setError(error.message);
      setShowConfigForm(true); // Show form again on error
    }
  };

  // Function to hide embedded checkout and return to main view
  const hideEmbeddedCheckout = useCallback(() => {
    // Clean up checkout
    if (window.Checkout) {
      try {
        window.Checkout.hideEmbeddedPage?.();
      } catch (e) {
        debugLog('Error hiding embedded page:', e);
      }
    }
    
    setShowEmbeddedCheckout(false);
    setShowConfigForm(true);
    setPaymentSession(null);
    setError(null);
    
    debugLog('Checkout closed, returned to configuration');
  }, [debugLog]);

  const styles = {
    app: {
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '20px',
      backgroundColor: '#f8fafc',
      minHeight: '100vh'
    },
    header: {
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white',
      padding: '30px',
      borderRadius: '12px',
      marginBottom: '30px',
      textAlign: 'center',
      boxShadow: '0 8px 32px rgba(102, 126, 234, 0.3)'
    },
    headerContent: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: '15px'
    },
    securityBadge: {
      backgroundColor: 'rgba(255,255,255,0.2)',
      padding: '8px 16px',
      borderRadius: '25px',
      fontSize: '14px',
      backdropFilter: 'blur(10px)'
    },
    statusIndicator: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      backgroundColor: 'rgba(255,255,255,0.15)',
      padding: '6px 12px',
      borderRadius: '20px',
      fontSize: '13px'
    },
    statusDot: {
      width: '8px',
      height: '8px',
      borderRadius: '50%',
      backgroundColor: connectionStatus === 'connected' ? '#22c55e' : 
                     connectionStatus === 'checking' ? '#f59e0b' : '#ef4444'
    },
    envBadge: {
      position: 'absolute',
      top: '15px',
      right: '15px',
      backgroundColor: '#d97706',
      color: 'white',
      padding: '4px 12px',
      borderRadius: '6px',
      fontSize: '11px',
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: '0.5px'
    },
    configForm: {
      backgroundColor: 'white',
      padding: '32px',
      borderRadius: '12px',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
      marginBottom: '24px',
      position: 'relative',
      border: '1px solid #e2e8f0'
    },
    modeToggle: {
      display: 'flex',
      gap: '6px',
      marginBottom: '30px',
      padding: '6px',
      backgroundColor: '#f1f5f9',
      borderRadius: '10px',
      border: '1px solid #e2e8f0'
    },
    modeButton: {
      flex: 1,
      padding: '12px 16px',
      border: 'none',
      borderRadius: '8px',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      fontWeight: '500',
      fontSize: '14px'
    },
    modeButtonActive: {
      backgroundColor: '#667eea',
      color: 'white',
      boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)'
    },
    modeButtonInactive: {
      backgroundColor: 'transparent',
      color: '#64748b'
    },
    toolsSection: {
      marginBottom: '25px',
      display: 'flex',
      gap: '12px',
      flexWrap: 'wrap'
    },
    toolButton: {
      padding: '8px 16px',
      border: '2px solid #e2e8f0',
      borderRadius: '8px',
      backgroundColor: 'white',
      color: '#475569',
      fontSize: '13px',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      fontWeight: '500'
    },
    formGroup: {
      marginBottom: '20px'
    },
    formRow: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '20px',
      marginBottom: '20px'
    },
    label: {
      display: 'block',
      marginBottom: '6px',
      fontWeight: '600',
      color: '#374151',
      fontSize: '14px'
    },
    input: {
      width: '100%',
      padding: '12px 16px',
      border: '2px solid #e5e7eb',
      borderRadius: '8px',
      fontSize: '14px',
      transition: 'all 0.2s ease',
      boxSizing: 'border-box',
      backgroundColor: '#ffffff'
    },
    textarea: {
      width: '100%',
      padding: '16px',
      border: '2px solid #e5e7eb',
      borderRadius: '8px',
      fontSize: '13px',
      minHeight: '420px',
      resize: 'vertical',
      fontFamily: '"Fira Code", "JetBrains Mono", Monaco, Menlo, "Ubuntu Mono", monospace',
      boxSizing: 'border-box',
      lineHeight: '1.5',
      backgroundColor: '#f8fafc'
    },
    textareaError: {
      borderColor: '#ef4444'
    },
    jsonError: {
      color: '#dc2626',
      fontSize: '12px',
      marginTop: '6px',
      padding: '10px',
      backgroundColor: '#fef2f2',
      border: '1px solid #fecaca',
      borderRadius: '6px'
    },
    paymentButton: {
      width: '100%',
      padding: '16px 24px',
      backgroundColor: '#059669',
      color: 'white',
      border: 'none',
      borderRadius: '10px',
      fontSize: '16px',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '12px',
      marginBottom: '12px',
      boxShadow: '0 4px 12px rgba(5, 150, 105, 0.3)'
    },
    paymentButtonDisabled: {
      backgroundColor: '#9ca3af',
      cursor: 'not-allowed',
      transform: 'none',
      boxShadow: 'none'
    },
    secondaryButton: {
      width: '100%',
      padding: '12px 20px',
      backgroundColor: '#f8fafc',
      color: '#475569',
      border: '2px solid #e2e8f0',
      borderRadius: '8px',
      fontSize: '14px',
      fontWeight: '500',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      marginBottom: '8px'
    },
    spinner: {
      border: '2px solid transparent',
      borderTop: '2px solid currentColor',
      borderRadius: '50%',
      width: '20px',
      height: '20px',
      animation: 'spin 1s linear infinite'
    },
    errorMessage: {
      backgroundColor: '#fef2f2',
      color: '#dc2626',
      padding: '16px',
      borderRadius: '8px',
      marginBottom: '20px',
      border: '1px solid #fecaca',
      display: 'flex',
      alignItems: 'flex-start',
      gap: '10px'
    },
    successMessage: {
      backgroundColor: '#f0fdf4',
      color: '#166534',
      padding: '16px',
      borderRadius: '8px',
      marginBottom: '20px',
      border: '1px solid #bbf7d0',
      display: 'flex',
      alignItems: 'flex-start',
      gap: '10px'
    },
    embeddedContainer: {
      backgroundColor: 'white',
      padding: '24px',
      borderRadius: '12px',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
      border: '1px solid #e2e8f0'
    },
    backButton: {
      background: 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)',
      color: 'white',
      border: 'none',
      padding: '10px 20px',
      borderRadius: '8px',
      cursor: 'pointer',
      marginBottom: '20px',
      fontSize: '14px',
      fontWeight: '500',
      transition: 'all 0.2s ease'
    },
    embedTarget: {
      minHeight: '500px',
      border: '2px solid #e5e7eb',
      borderRadius: '10px',
      backgroundColor: '#ffffff',
      position: 'relative'
    },
    sectionTitle: {
      color: '#667eea',
      fontSize: '18px',
      fontWeight: '700',
      marginBottom: '16px',
      borderBottom: '2px solid #e5e7eb',
      paddingBottom: '8px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    },
    infoBox: {
      backgroundColor: '#eff6ff',
      color: '#1e40af',
      padding: '14px 16px',
      borderRadius: '8px',
      marginBottom: '16px',
      fontSize: '14px',
      border: '1px solid #dbeafe',
      display: 'flex',
      alignItems: 'flex-start',
      gap: '10px'
    },
    debugPanel: {
      backgroundColor: '#1f2937',
      color: '#e5e7eb',
      padding: '16px',
      borderRadius: '8px',
      marginTop: '16px',
      fontSize: '12px',
      fontFamily: 'monospace',
      maxHeight: '200px',
      overflow: 'auto'
    }
  };

  const getCurrentAmount = () => {
    if (useAdvancedMode) {
      try {
        const parsed = JSON.parse(jsonPayload);
        return parsed.order?.amount || '99.00';
      } catch {
        return '99.00';
      }
    } else {
      return orderConfig.amount;
    }
  };

  const isFormValid = () => {
    if (useAdvancedMode) {
      return !jsonError && jsonPayload.trim() !== '' && config.merchantId && config.username && config.password;
    } else {
      return config.merchantId && config.username && config.password && 
             orderConfig.amount && orderConfig.currency && orderConfig.description &&
             parseFloat(orderConfig.amount) > 0;
    }
  };

  return (
    <div style={styles.app}>
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          
          @media (max-width: 768px) {
            .form-row {
              grid-template-columns: 1fr !important;
            }
          }
          
          .input-focused {
            border-color: #667eea !important;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1) !important;
          }
          
          .tool-button:hover {
            border-color: #667eea;
            color: #667eea;
          }
          
          .payment-button:hover:not(:disabled) {
            background-color: #047857;
            transform: translateY(-1px);
            box-shadow: 0 6px 16px rgba(5, 150, 105, 0.4);
          }
