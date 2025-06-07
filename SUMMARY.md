# Project: DocuChat AI - Demo Interface

## Goal

The primary goal of this project is to create a modern, professional, and interactive web-based UI demo for a conceptual LLM (Large Language Model) + OCR (Optical Character Recognition) service. The interface should allow users to:

1.  **Upload a PDF document.**
2.  **Configure OCR Effort:** Provide a way for the user to select the desired OCR processing effort/accuracy (e.g., using a slider from "quick and less accurate" to "slow and accurate").
3.  **Document Processing & Preview:** Simulate OCR processing of the uploaded document and display a preview of its first page.
4.  **Interactive Chat:** Allow the user to chat with an AI about the content of the processed document.
5.  **Model Selection:** Offer the user a choice between different AI chat models (e.g., a "plain" model and a "thinking" model).
6.  **Modern UI/UX:** The application should have a modern, clean, and intuitive user interface, drawing inspiration from contemporary chat applications like Gemini, ChatGPT, and Claude.

The backend API calls for OCR and LLM interactions are to be simulated with placeholders for this demo.

## What We've Done So Far

1.  **Initial Application Structure (MVP):**
    *   Set up a React-based single-page application (`index.tsx`, `index.html`, `index.css`).
    *   Implemented a three-stage user flow:
        *   **Upload View:** A simple, centered interface for PDF file selection.
        *   **OCR Configuration View:** Displayed after file selection, featuring a slider for OCR effort and a button to initiate processing.
        *   **Chat View:** Activated after simulated OCR processing. It included a placeholder for the document preview, a chat history display, a message input field, and radio buttons for model selection ("Plain" vs. "Thinking").
    *   All backend operations (OCR processing, AI chat responses) were simulated using `setTimeout` to mimic asynchronous API calls.
    *   Basic styling was applied for functionality and a professional look.

2.  **Modern UI/UX Overhaul (Second Iteration):**
    *   Significantly redesigned the application to align with modern chat application aesthetics.
    *   **New Layout:** Implemented a two-column layout:
        *   **Sidebar (Left):**
            *   Displays a "DocuChat AI" header.
            *   Features a "New Document" button for resetting the application.
            *   Shows information about the currently active document (name, OCR settings summary).
            *   Displays a larger preview of the document's first page once processed and in the chat view.
            *   Includes a snippet of the OCR context text.
        *   **Main Content Area (Right):**
            *   Dynamically renders the current view: Upload, OCR Configuration, or Chat.
    *   **Visual Enhancements:**
        *   Adopted a cleaner color palette (light grays, whites, with a primary blue accent - `var(--primary-accent: #1a73e8;)`).
        *   Integrated the "Inter" font for a modern typographic feel.
        *   Restyled UI components:
            *   Buttons: Pill-shaped, with icons.
            *   Inputs: Rounded, modern appearance.
            *   Chat Bubbles: Differentiated styles for user and AI messages, with AI messages having a simple "AI" avatar and user messages having a user icon. "Thinking" AI model messages have a distinct style.
            *   Slider: Styled for better visual appeal.
    *   **Improved User Experience (UX):**
        *   Streamlined the flow between views.
        *   Enhanced visual feedback for loading states (spinners).
        *   Improved layout and spacing for better readability and visual hierarchy.
        *   The chat input area is now a fixed bar at the bottom of the chat view, with a text field and an icon-based send button.
        *   Model selection is presented more cleanly within the chat view.
    *   **Code Refinements:**
        *   Updated CSS with variables for easier theming and maintenance.
        *   Refactored React components for clarity and to support the new layout.
        *   Included Font Awesome for icons.
        *   Added basic responsive design considerations, allowing the sidebar to stack on top of the main content on smaller screens.
    *   **Accessibility:** Maintained and included ARIA attributes for better accessibility.

The application now presents a polished and contemporary demo interface for the envisioned LLM + OCR service, effectively showcasing the intended user journey with simulated interactions.
