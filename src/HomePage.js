import React, { useState, useEffect } from 'react';

function HomePage() {
  const [paymentSession, setPaymentSession] = useState(null);
  const [isCheckoutReady, setIsCheckoutReady] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [error, setError] = useState(null);
  const [scriptKey, setScriptKey] = useState(0);
  const [showEmbeddedCheckout, setShowEmbeddedCheckout] = useState(false);
  const [showConfigForm, setShowConfigForm] = useState(true);
  // Configuration for API credentials
  const [config, setConfig] = useState({
    merchantId: 'TESTMIDtesting00',
    username: 'merchant.TESTMIDtesting00',
    password: '9233298fcaa1c01f578759954343aca1',
    apiBaseUrl: 'https://mtf.gateway.mastercard.com',
    apiVersion: '73'
  });

  // JSON payload for advanced mode
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

  // Load/reload Mastercard Checkout script
  useEffect(() => {
    const existingScript = document.querySelector('script[src*="checkout.min.js"]');
    if (existingScript) {
      existingScript.remove();
      delete window.Checkout;
    }

    const script = document.createElement('script');
    script.src = 'https://mtf.gateway.mastercard.com/static/checkout/checkout.min.js';
    script.async = true;
    script.onload = () => {
      console.log('Checkout script loaded successfully');
      setIsCheckoutReady(true);
    };
    script.onerror = () => {
      console.error('Failed to load checkout script');
      setError('Failed to load payment system. Please refresh and try again.');
    };
    document.head.appendChild(script);

    return () => {
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, [scriptKey]);

  // Configure checkout when script is loaded and session is available
  useEffect(() => {
    if (isCheckoutReady && window.Checkout && paymentSession) {
      console.log('Configuring checkout with session:', paymentSession);
      
      try {
        setTimeout(() => {
          const configObj = {
            session: {
              id: paymentSession
            }
          };
          
          console.log('Configuration object:', configObj);
          window.Checkout.configure(configObj);
          console.log('Configuration completed successfully');
        }, 100);
        
      } catch (configError) {
        console.error('Error configuring checkout:', configError);
        setError('Failed to configure payment system: ' + configError.message);
      }
    }
  }, [isCheckoutReady, paymentSession]);

  // Handle config changes with automatic username generation
  const handleConfigChange = (field, value) => {
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
  };

  // Handle JSON payload changes with validation
  const handleJsonChange = (value) => {
    setJsonPayload(value);
    setJsonError(null);
    
    try {
      JSON.parse(value);
    } catch (e) {
      setJsonError(`Invalid JSON: ${e.message}`);
    }
  };

  // Generate order ID and update JSON
  const updateJsonWithOrderId = (json) => {
    const orderId = `ORDER_${Date.now()}`;
    return json.replace('"ORDER_PLACEHOLDER"', `"${orderId}"`);
  };

  // Validate and parse JSON payload
  const getValidatedPayload = () => {
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
      
      return parsed;
    } catch (e) {
      throw new Error(`JSON Validation Error: ${e.message}`);
    }
  };

  // Function to call the API
  const getSessionId = async () => {
    setIsLoadingSession(true);
    setError(null);
    
    try {
      // Validate JSON payload
      const validatedPayload = getValidatedPayload();
      
      const requestBody = {
        mode: 'json',
        ...config, // Include auth config
        jsonPayload: validatedPayload
      };

      console.log('Sending request:', requestBody);

      const response = await fetch('https://hco-configurable-embedded-backend.vercel.app/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorData}`);
      }

      const data = await response.text();
      console.log('Session ID received:', data);
      
      return data;
    } catch (error) {
      console.error('Error fetching session ID:', error);
      setError(error.message);
      throw error;
    } finally {
      setIsLoadingSession(false);
    }
  };

  const openCheckoutPage = async () => {
    try {
      // Validate JSON payload
      getValidatedPayload(); // This will throw if invalid

      // Hide configuration form
      setShowConfigForm(false);
      
      // Clear previous state
      console.log('Clearing all previous checkout state...');
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
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Get new session ID
      const sessionId = await getSessionId();
      
      // Set the new session ID
      const trimmedSessionId = sessionId.trim();
      console.log('Setting NEW session ID:', trimmedSessionId);
      setPaymentSession(trimmedSessionId);
      
      // Wait for configuration to complete, then show embedded payment page
      setTimeout(() => {
        if (window.Checkout && isCheckoutReady) {
          try {
            console.log('About to call showEmbeddedPage with session:', trimmedSessionId);
            
            // Show the embedded checkout container
            setShowEmbeddedCheckout(true);
            
            // Wait for DOM update, then embed checkout
            setTimeout(() => {
              window.Checkout.showEmbeddedPage('#embed-target');
              console.log('Embedded payment page displayed successfully');
            }, 100);
            
          } catch (showError) {
            console.error('Exception showing embedded payment page:', showError);
            setError('Failed to display payment page: ' + showError.message);
          }
        } else {
          setError('Checkout system not ready. Please try again.');
        }
      }, 600);
      
    } catch (error) {
      console.error('Failed to open checkout page:', error);
      setError(error.message);
      setShowConfigForm(true); // Show form again on error
    }
  };

  // Function to hide embedded checkout and return to main view
  const hideEmbeddedCheckout = () => {
    setShowEmbeddedCheckout(false);
    setShowConfigForm(true);
    setPaymentSession(null);
    setError(null);
  };

  const styles = {
    app: {
      fontFamily: 'Arial, sans-serif',
      maxWidth: '1000px',
      margin: '0 auto',
      padding: '20px',
      backgroundColor: '#f5f5f5',
      minHeight: '100vh'
    },
    header: {
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white',
      padding: '30px',
      borderRadius: '10px',
      marginBottom: '30px',
      textAlign: 'center'
    },
    headerContent: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap'
    },
    securityBadge: {
      backgroundColor: 'rgba(255,255,255,0.2)',
      padding: '8px 16px',
      borderRadius: '20px',
      fontSize: '14px'
    },
    configForm: {
      backgroundColor: 'white',
      padding: '30px',
      borderRadius: '10px',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
      marginBottom: '20px'
    },
    modeToggle: {
      display: 'flex',
      gap: '10px',
      marginBottom: '25px',
      padding: '4px',
      backgroundColor: '#f8f9fa',
      borderRadius: '8px',
      border: '1px solid #e1e5e9'
    },
    modeButton: {
      flex: 1,
      padding: '10px',
      border: 'none',
      borderRadius: '6px',
      cursor: 'pointer',
      transition: 'all 0.3s ease',
      fontWeight: '500'
    },
    modeButtonActive: {
      backgroundColor: '#667eea',
      color: 'white'
    },
    modeButtonInactive: {
      backgroundColor: 'transparent',
      color: '#666'
    },
    formGroup: {
      marginBottom: '20px'
    },
    formRow: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '15px',
      marginBottom: '20px'
    },
    label: {
      display: 'block',
      marginBottom: '5px',
      fontWeight: 'bold',
      color: '#333'
    },
    input: {
      width: '100%',
      padding: '12px',
      border: '2px solid #e1e5e9',
      borderRadius: '6px',
      fontSize: '14px',
      transition: 'border-color 0.3s ease',
      boxSizing: 'border-box'
    },
    textarea: {
      width: '100%',
      padding: '12px',
      border: '2px solid #e1e5e9',
      borderRadius: '6px',
      fontSize: '13px',
      minHeight: '400px',
      resize: 'vertical',
      fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
      boxSizing: 'border-box',
      lineHeight: '1.4'
    },
    textareaError: {
      borderColor: '#dc3545'
    },
    jsonError: {
      color: '#dc3545',
      fontSize: '12px',
      marginTop: '5px',
      padding: '8px',
      backgroundColor: '#f8d7da',
      border: '1px solid #f5c6cb',
      borderRadius: '4px'
    },
    paymentButton: {
      width: '100%',
      padding: '15px',
      backgroundColor: '#28a745',
      color: 'white',
      border: 'none',
      borderRadius: '8px',
      fontSize: '16px',
      fontWeight: 'bold',
      cursor: 'pointer',
      transition: 'background-color 0.3s ease',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '10px'
    },
    paymentButtonDisabled: {
      backgroundColor: '#6c757d',
      cursor: 'not-allowed'
    },
    spinner: {
      border: '2px solid #f3f3f3',
      borderTop: '2px solid #ffffff',
      borderRadius: '50%',
      width: '20px',
      height: '20px',
      animation: 'spin 1s linear infinite'
    },
    errorMessage: {
      backgroundColor: '#f8d7da',
      color: '#721c24',
      padding: '15px',
      borderRadius: '6px',
      marginBottom: '20px',
      border: '1px solid #f5c6cb'
    },
    embeddedContainer: {
      backgroundColor: 'white',
      padding: '20px',
      borderRadius: '10px',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
    },
    backButton: {
      background: 'none',
      border: '1px solid #ddd',
      padding: '8px 16px',
      borderRadius: '4px',
      cursor: 'pointer',
      marginBottom: '20px',
      fontSize: '14px'
    },
    embedTarget: {
      minHeight: '500px',
      border: '1px solid #e0e0e0',
      borderRadius: '8px',
      backgroundColor: '#fff'
    },
    jsonInfo: {
      backgroundColor: '#d1ecf1',
      color: '#0c5460',
      padding: '12px',
      borderRadius: '6px',
      marginBottom: '15px',
      fontSize: '14px',
      border: '1px solid #bee5eb'
    }
  };

  const getAmountFromJson = () => {
    try {
      const parsed = JSON.parse(jsonPayload);
      return parsed.order?.amount || '99.00';
    } catch {
      return '99.00';
    }
  };

  const isFormValid = () => {
    return !jsonError && jsonPayload.trim() !== '' && config.merchantId && config.username && config.password;
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
        `}
      </style>

      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <h1 style={{margin: 0}}>Mastercard Hosted Checkout</h1>
          <div style={styles.securityBadge}>
            <span>🔒 Secure Payments</span>
          </div>
        </div>
      </header>

      {/* Error Message */}
      {error && (
        <div style={styles.errorMessage}>
          <p style={{margin: 0}}>⚠️ {error}</p>
        </div>
      )}

      {/* Configuration Form */}
      {showConfigForm && !showEmbeddedCheckout && (
        <div style={styles.configForm}>
          <h2 style={{marginTop: 0, color: '#333', marginBottom: '25px'}}>Payment Configuration</h2>
          
          {/* API Configuration */}
          <div style={styles.formRow} className="form-row">
            <div style={styles.formGroup}>
              <label style={styles.label}>Merchant ID</label>
              <input
                style={styles.input}
                type="text"
                value={config.merchantId}
                onChange={(e) => handleConfigChange('merchantId', e.target.value)}
                placeholder="TESTMIDtesting00"
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Username (auto-generated)</label>
              <input
                style={{...styles.input, backgroundColor: '#f8f9fa', color: '#666'}}
                type="text"
                value={config.username}
                readOnly
                placeholder="merchant.TESTMIDtesting00"
              />
            </div>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Password</label>
            <input
              style={styles.input}
              type="password"
              value={config.password}
              onChange={(e) => handleConfigChange('password', e.target.value)}
              placeholder="Enter your Mastercard API password"
            />
          </div>

          <div style={styles.formRow} className="form-row">
            <div style={styles.formGroup}>
              <label style={styles.label}>API Base URL</label>
              <input
                style={styles.input}
                type="text"
                value={config.apiBaseUrl}
                onChange={(e) => handleConfigChange('apiBaseUrl', e.target.value)}
                placeholder="https://mtf.gateway.mastercard.com"
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>API Version</label>
              <input
                style={styles.input}
                type="text"
                value={config.apiVersion}
                onChange={(e) => handleConfigChange('apiVersion', e.target.value)}
                placeholder="73"
              />
            </div>
          </div>

          {/* JSON Editor */}
          <div style={styles.jsonInfo}>
            💡 <strong>Advanced JSON Mode:</strong> Edit the complete JSON request payload. 
            Use "ORDER_PLACEHOLDER" for the order ID - it will be auto-generated.
            This gives you full control over checkout behavior and UI options.
          </div>
          
          <div style={styles.formGroup}>
            <label style={styles.label}>JSON Request Payload</label>
            <textarea
              style={{
                ...styles.textarea,
                ...(jsonError ? styles.textareaError : {})
              }}
              value={jsonPayload}
              onChange={(e) => handleJsonChange(e.target.value)}
              placeholder="Enter complete JSON payload..."
            />
            {jsonError && (
              <div style={styles.jsonError}>
                {jsonError}
              </div>
            )}
          </div>

          <button 
            onClick={openCheckoutPage} 
            style={{
              ...styles.paymentButton,
              ...(isLoadingSession || !isFormValid() ? styles.paymentButtonDisabled : {})
            }}
            disabled={isLoadingSession || !isFormValid()}
          >
            {isLoadingSession ? (
              <>
                <div style={styles.spinner}></div>
                <span>Initializing Payment...</span>
              </>
            ) : (
              <>
                💳 <span>Proceed to Checkout (${getAmountFromJson()})</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Embedded Checkout View */}
      {showEmbeddedCheckout && (
        <div style={styles.embeddedContainer}>
          <div>
            <button 
              onClick={hideEmbeddedCheckout}
              style={styles.backButton}
            >
              ← Back to Configuration
            </button>
          </div>
          
          <div 
            id="embed-target" 
            style={styles.embedTarget}
          >
            {/* Checkout form will be embedded here by Mastercard */}
          </div>
        </div>
      )}
    </div>
  );
}

export default HomePage;
