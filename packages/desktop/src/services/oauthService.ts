/**
 * OAuth Service for Desktop App
 * Handles external browser OAuth flow with manual code exchange
 */

import { open } from '@tauri-apps/api/shell';

export class OAuthService {
  /**
   * Open OAuth URL in external browser
   */
  async openOAuthInBrowser(authUrl: string): Promise<void> {
    try {
      await open(authUrl);
    } catch (error) {
      console.error('Failed to open browser:', error);
      throw new Error('Không thể mở trình duyệt. Vui lòng copy URL và mở thủ công.');
    }
  }

  /**
   * Generate Google OAuth URL for desktop app
   * Uses out-of-band (OOB) flow for manual code exchange
   */
  generateGoogleOAuthUrl(clientId: string): string {
    // Use urn:ietf:wg:oauth:2.0:oob for desktop apps (shows code on success page)
    const redirectUri = 'urn:ietf:wg:oauth:2.0:oob';
    const scope = 'email profile';
    
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scope,
      access_type: 'offline', // For refresh token
      prompt: 'select_account'
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /**
   * Copy text to clipboard (utility function)
   */
  async copyToClipboard(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      throw new Error('Không thể copy vào clipboard');
    }
  }
}

export default new OAuthService();
