import { getContext } from "../../../../extensions.js";
import { extension_settings } from "../../../../extensions.js";
import { dragElement } from './shared.js';

export class UserOutfitPanel {
    constructor(outfitManager, clothingSlots, accessorySlots, saveSettingsDebounced) {
        this.outfitManager = outfitManager;
        this.clothingSlots = clothingSlots;
        this.accessorySlots = accessorySlots;
        this.isVisible = false;
        this.domElement = null;
        this.currentTab = 'clothing';
        this.saveSettingsDebounced = saveSettingsDebounced;
    }

    createPanel() {
        if (this.domElement) {
            return this.domElement;
        }

        const panel = document.createElement('div');
        panel.id = 'user-outfit-panel';
        panel.className = 'outfit-panel';

        panel.innerHTML = `
            <div class="outfit-header">
                <h3>Your Outfit</h3>
                <div class="outfit-actions">
                    <span class="outfit-action" id="user-outfit-refresh">↻</span>
                    <span class="outfit-action" id="user-outfit-close">×</span>
                </div>
            </div>
            <div class="outfit-tabs">
                <button class="outfit-tab${this.currentTab === 'clothing' ? ' active' : ''}" data-tab="clothing">Clothing</button>
                <button class="outfit-tab${this.currentTab === 'accessories' ? ' active' : ''}" data-tab="accessories">Accessories</button>
                <button class="outfit-tab${this.currentTab === 'outfits' ? ' active' : ''}" data-tab="outfits">Outfits</button>
            </div>
            <div class="outfit-content" id="user-outfit-tab-content"></div> <!-- UPDATED CONTAINER -->
        `;

        document.body.appendChild(panel);
        
        const tabs = panel.querySelectorAll('.outfit-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', (event) => {
                const tabName = event.target.dataset.tab;
                this.currentTab = tabName;
                this.renderContent();
                
                tabs.forEach(t => t.classList.remove('active'));
                event.target.classList.add('active');
            });
        });

        return panel;
    }

    renderContent() {
        if (!this.domElement) return;
        
        // Get the scrollable content container
        const contentArea = this.domElement.querySelector('.outfit-content');
        if (!contentArea) return;
        
        contentArea.innerHTML = '';
        
        switch(this.currentTab) {
            case 'clothing':
                this.renderSlots(this.clothingSlots, contentArea);
                break;
            case 'accessories':
                this.renderSlots(this.accessorySlots, contentArea);
                break;
            case 'outfits':
                this.renderPresets(contentArea);
                break;
        }
    }

    renderSlots(slots, container) {
        const outfitData = this.outfitManager.getOutfitData(slots);
    
        outfitData.forEach(slot => { // FIX TYPO: changed outfitslots -> outfitData
            const slotElement = document.createElement('div');
            slotElement.className = 'outfit-slot';
            slotElement.dataset.slot = slot.name;
    
            slotElement.innerHTML = `
                <div class="slot-label">${this.formatSlotName(slot.name)}</div>
                <div class="slot-value" title="${slot.value}">${slot.value}</div>
                <div class="slot-actions">
                    <button class="slot-change">Change</button>
                </div>
            `;
    
            slotElement.querySelector('.slot-change').addEventListener('click', async () => {
                const message = await this.outfitManager.changeOutfitItem(slot.name);
                if (message && extension_settings.outfit_tracker?.enableSysMessages) {
                    this.sendSystemMessage(message);
                }
                this.saveSettingsDebounced();
                this.renderContent();
            });
    
            container.appendChild(slotElement);
        });
    }

    renderPresets(container) {
        const presets = this.outfitManager.getPresets();
        
        if (presets.length === 0) {
            container.innerHTML = '<div>No saved outfits.</div>';
        } else {
            presets.forEach(preset => {
                const presetElement = document.createElement('div');
                presetElement.className = 'outfit-preset';
                presetElement.innerHTML = `
                    <div class="preset-name">${preset}</div>
                    <div class="preset-actions">
                        <button class="load-preset" data-preset="${preset}">Wear</button>
                        <button class="delete-preset" data-preset="${preset}">×</button>
                    </div>
                `;
                
                presetElement.querySelector('.load-preset').addEventListener('click', async () => {
                    const message = await this.outfitManager.loadPreset(preset);
                    if (message && extension_settings.outfit_tracker?.enableSysMessages) {
                        this.sendSystemMessage(message);
                    }
                    this.saveSettingsDebounced();
                    this.renderContent();
                });
                
                presetElement.querySelector('.delete-preset').addEventListener('click', () => {
                    if (confirm(`Delete "${preset}" outfit?`)) {
                        const message = this.outfitManager.deletePreset(preset);
                        if (message && extension_settings.outfit_tracker?.enableSysMessages) {
                            this.sendSystemMessage(message);
                        }
                        this.saveSettingsDebounced();
                        this.renderPresets(container);
                    }
                });
                
                container.appendChild(presetElement);
            });
        }
        
        const saveButton = document.createElement('button');
        saveButton.className = 'save-outfit-btn';
        saveButton.textContent = 'Save Current Outfit';
        saveButton.addEventListener('click', async () => {
            const presetName = prompt('Name this outfit:');
            if (presetName) {
                const message = await this.outfitManager.savePreset(presetName.trim());
                if (message && extension_settings.outfit_tracker?.enableSysMessages) {
                    this.sendSystemMessage(message);
                }
                this.saveSettingsDebounced();
                this.renderPresets(container);
            }
        });
        
        container.appendChild(saveButton);
    }

    sendSystemMessage(message) {
        setTimeout(() => {
            try {
                const chatInput = document.getElementById('send_textarea');
                if (!chatInput) {
                    console.error('Chat input not found');
                    return;
                }
                
                chatInput.value = `/sys compact=true ${message}`;
                chatInput.dispatchEvent(new Event('input', { bubbles: true }));
                
                setTimeout(() => {
                    const sendButton = document.querySelector('#send_but');
                    if (sendButton) {
                        sendButton.click();
                    } else {
                        const event = new KeyboardEvent('keydown', {
                            key: 'Enter',
                            code: 'Enter',
                            bubbles: true
                        });
                        chatInput.dispatchEvent(event);
                    }
                }, 100);
            } catch (error) {
                console.error("Failed to send system message:", error);
            }
        }, 100);
    }

    formatSlotName(name) {
        return name
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .replace(/^./, str => str.toUpperCase())
            .replace(/-/g, ' ')
            .replace('underwear', 'Underwear');
    }

    toggle() {
        this.isVisible ? this.hide() : this.show();
    }

    show() {
        if (!this.domElement) {
            this.domElement = this.createPanel();
        }
        
        this.renderContent();
        this.domElement.style.display = 'flex'; // CHANGED to flex
        this.isVisible = true;

        if (this.domElement) {
            dragElement($(this.domElement));
            
            this.domElement.querySelector('#user-outfit-refresh')?.addEventListener('click', () => {
                this.outfitManager.initializeOutfit();
                this.renderContent();
            });

            this.domElement.querySelector('#user-outfit-close')?.addEventListener('click', () => this.hide());
        }
    }

    hide() {
        if (this.domElement) {
            this.domElement.style.display = 'none';
        }
        this.isVisible = false;
    }
}
