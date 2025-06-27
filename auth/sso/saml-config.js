// SAML 2.0 Configuration for Enterprise SSO
const saml2 = {
    // Service Provider (SP) Configuration
    sp: {
        entityId: 'https://app.rootuip.com/saml/metadata',
        assertionConsumerService: {
            url: 'https://app.rootuip.com/saml/acs',
            binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST'
        },
        singleLogoutService: {
            url: 'https://app.rootuip.com/saml/sls',
            binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect'
        },
        x509cert: '', // Will be generated
        privateKey: '' // Will be generated
    },

    // Identity Provider (IdP) Templates
    idpTemplates: {
        okta: {
            entryPoint: 'https://{subdomain}.okta.com/app/{appId}/sso/saml',
            issuer: 'http://www.okta.com/{appId}',
            cert: '', // Provided by Okta
            signatureAlgorithm: 'sha256',
            digestAlgorithm: 'sha256',
            attributeMapping: {
                email: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
                firstName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname',
                lastName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname',
                groups: 'http://schemas.xmlsoap.org/claims/Group'
            }
        },
        azureAD: {
            entryPoint: 'https://login.microsoftonline.com/{tenantId}/saml2',
            issuer: 'https://sts.windows.net/{tenantId}/',
            cert: '', // Provided by Azure AD
            signatureAlgorithm: 'sha256',
            digestAlgorithm: 'sha256',
            attributeMapping: {
                email: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
                firstName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname',
                lastName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname',
                upn: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/upn',
                groups: 'http://schemas.microsoft.com/ws/2008/06/identity/claims/groups'
            }
        },
        oneLogin: {
            entryPoint: 'https://{subdomain}.onelogin.com/trust/saml2/http-post/sso/{appId}',
            issuer: 'https://app.onelogin.com/saml/metadata/{appId}',
            cert: '', // Provided by OneLogin
            signatureAlgorithm: 'sha256',
            digestAlgorithm: 'sha256',
            attributeMapping: {
                email: 'User.email',
                firstName: 'User.FirstName',
                lastName: 'User.LastName',
                role: 'memberOf'
            }
        },
        ping: {
            entryPoint: 'https://{domain}/idp/SSO.saml2',
            issuer: 'https://{domain}',
            cert: '', // Provided by PingIdentity
            signatureAlgorithm: 'sha256',
            digestAlgorithm: 'sha256',
            attributeMapping: {
                email: 'mail',
                firstName: 'givenName',
                lastName: 'sn',
                groups: 'memberOf'
            }
        }
    },

    // SAML Response Validation
    validation: {
        wantAssertionsSigned: true,
        wantMessageSigned: true,
        wantLogoutRequestSigned: true,
        wantLogoutResponseSigned: true,
        signatureAlgorithms: ['http://www.w3.org/2001/04/xmldsig-more#rsa-sha256'],
        maxAssertionAgeMs: 600000, // 10 minutes
        audienceValidation: true,
        destinationValidation: true,
        inResponseToValidation: true
    },

    // Attribute Mapping Configuration
    defaultAttributeMapping: {
        id: 'nameID',
        email: 'email',
        name: 'displayName',
        firstName: 'givenName',
        lastName: 'surname',
        groups: 'memberOf',
        department: 'department',
        company: 'company'
    },

    // Role Mapping from IdP Groups
    roleMapping: {
        'rootuip-admins': 'admin',
        'rootuip-operators': 'operator',
        'rootuip-viewers': 'viewer',
        'rootuip-customers': 'customer',
        'Admin': 'admin',
        'Operations': 'operator',
        'ReadOnly': 'viewer'
    }
};

// SAML Metadata Generator
function generateMetadata(config) {
    return `<?xml version="1.0"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata"
                  entityID="${config.sp.entityId}">
    <SPSSODescriptor AuthnRequestsSigned="true"
                     WantAssertionsSigned="true"
                     protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
        <KeyDescriptor use="signing">
            <KeyInfo xmlns="http://www.w3.org/2000/09/xmldsig#">
                <X509Data>
                    <X509Certificate>${config.sp.x509cert}</X509Certificate>
                </X509Data>
            </KeyInfo>
        </KeyDescriptor>
        <SingleLogoutService Binding="${config.sp.singleLogoutService.binding}"
                            Location="${config.sp.singleLogoutService.url}"/>
        <NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</NameIDFormat>
        <NameIDFormat>urn:oasis:names:tc:SAML:2.0:nameid-format:persistent</NameIDFormat>
        <NameIDFormat>urn:oasis:names:tc:SAML:2.0:nameid-format:transient</NameIDFormat>
        <AssertionConsumerService Binding="${config.sp.assertionConsumerService.binding}"
                                 Location="${config.sp.assertionConsumerService.url}"
                                 index="1"/>
    </SPSSODescriptor>
    <Organization>
        <OrganizationName xml:lang="en">ROOTUIP</OrganizationName>
        <OrganizationDisplayName xml:lang="en">ROOTUIP - Real-time Ocean Operations</OrganizationDisplayName>
        <OrganizationURL xml:lang="en">https://rootuip.com</OrganizationURL>
    </Organization>
    <ContactPerson contactType="technical">
        <GivenName>Technical</GivenName>
        <SurName>Support</SurName>
        <EmailAddress>support@rootuip.com</EmailAddress>
    </ContactPerson>
</EntityDescriptor>`;
}

module.exports = {
    saml2,
    generateMetadata
};