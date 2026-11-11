<?php
const CHATGPT_HTML_BOOKMARKLET_VERSION = '0.11.23.1';
const CHATGPT_MARKDOWN_BOOKMARKLET_VERSION = '0.7.1.1';
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ChatGPT Exporter</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #333;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }

        .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
            overflow: hidden;
            animation: slideUp 0.8s ease-out;
        }

        @keyframes slideUp {
            from {
                opacity: 0;
                transform: translateY(30px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        .header {
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: white;
            padding: 40px;
            text-align: center;
        }

        .header h1 {
            font-size: 2.5rem;
            font-weight: 700;
            margin-bottom: 10px;
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }

        .header p {
            font-size: 1.2rem;
            opacity: 0.9;
        }

        .content {
            padding: 40px;
        }

        .step {
            margin-bottom: 40px;
            padding: 30px;
            background: #f8fafc;
            border-radius: 15px;
            border-left: 5px solid #10b981;
            transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .step:hover {
            transform: translateX(5px);
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
        }

        .step-number {
            display: inline-block;
            width: 40px;
            height: 40px;
            background: #10b981;
            color: white;
            border-radius: 50%;
            text-align: center;
            line-height: 40px;
            font-weight: bold;
            margin-right: 15px;
            margin-bottom: 15px;
        }

        .step h2 {
            color: #1f2937;
            margin-bottom: 15px;
            display: flex;
            align-items: center;
        }

        .bookmarklet-container {
            background: #1f2937;
            border-radius: 10px;
            padding: 20px;
            margin: 20px 0;
            position: relative;
            overflow: hidden;
        }

        .bookmarklet-container::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 3px;
            background: linear-gradient(90deg, #10b981, #3b82f6, #8b5cf6);
        }

        .bookmarklet {
            display: inline-block;
            background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
            color: white;
            text-decoration: none;
            padding: 15px 30px;
            margin-right: 20px;
            border-radius: 10px;
            font-weight: 600;
            font-size: 1.1rem;
            box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3);
            transition: all 0.3s ease;
            cursor: grab;
            position: relative;
            overflow: hidden;
        }

        .bookmarklet::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
            transition: left 0.5s ease;
        }

        .bookmarklet:hover::before {
            left: 100%;
        }

        .bookmarklet:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(59, 130, 246, 0.4);
        }

        .bookmarklet:active {
            cursor: grabbing;
        }

        .bookmarklet-version {
            display: block;
            margin-top: 4px;
            font-size: 0.72rem;
            font-weight: 500;
            line-height: 1;
            opacity: 0.75;
        }

        .drag-hint {
            margin-top: 15px;
            color: #6b7280;
            font-style: italic;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .drag-hint::before {
            content: "💡";
            font-size: 1.2rem;
        }

        .features {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin: 30px 0;
        }

        .feature {
            padding: 20px;
            background: white;
            border-radius: 10px;
            border: 2px solid #e5e7eb;
            text-align: center;
            transition: all 0.3s ease;
        }

        .feature:hover {
            border-color: #10b981;
            transform: translateY(-5px);
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
        }

        .feature-icon {
            font-size: 2rem;
            margin-bottom: 10px;
        }

        .feature h3 {
            color: #1f2937;
            margin-bottom: 10px;
        }

        .feature p {
            color: #6b7280;
            font-size: 0.9rem;
        }

        .warning {
            background: #fef3c7;
            border: 2px solid #f59e0b;
            border-radius: 10px;
            padding: 20px;
            margin: 20px 0;
        }

        .warning h3 {
            color: #92400e;
            margin-bottom: 10px;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .warning h3::before {
            content: "⚠️";
        }

        .warning p {
            color: #78350f;
        }

        .footer {
            background: #f9fafb;
            padding: 30px;
            text-align: center;
            color: #6b7280;
            border-top: 1px solid #e5e7eb;
        }

        .copy-button {
            background: #6b7280;
            color: white;
            border: none;
            padding: 8px 15px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 0.9rem;
            margin-left: 10px;
            transition: background 0.2s ease;
        }

        .copy-button:hover {
            background: #4b5563;
        }

        .copy-button.copied {
            background: #10b981;
        }

        @media (max-width: 768px) {
            .header h1 {
                font-size: 2rem;
            }
            
            .header p {
                font-size: 1rem;
            }
            
            .content {
                padding: 20px;
            }
            
            .step {
                padding: 20px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>ChatGPT Exporter</h1>
            <p>Export ChatGPT conversations to HTML or Markdown files</p>
        </div>

        <div class="content">
            <div class="step">
                <h2>
                    <span class="step-number">1</span>
                    Install the Bookmarklet
                </h2>
                <p>Drag a button to your browser's bookmarks bar:</p>
                <br>
                <?php
                $bookmarkletHtmlCode = @file_get_contents(__DIR__ . '/html_bookmarklet.js');
                $bookmarkletMarkdownCode = @file_get_contents(__DIR__ . '/markdown_bookmarklet.js');
                ?>
                <a href="<?php echo htmlspecialchars(trim($bookmarkletHtmlCode)); ?>" class="bookmarklet">
                    Export ChatGPT to HTML
                    <span class="bookmarklet-version">v<?php echo htmlspecialchars(CHATGPT_HTML_BOOKMARKLET_VERSION); ?></span>
                </a>
                <a href="<?php echo htmlspecialchars(trim($bookmarkletMarkdownCode)); ?>" class="bookmarklet">
                    Export ChatGPT to Markdown
                    <span class="bookmarklet-version">v<?php echo htmlspecialchars(CHATGPT_MARKDOWN_BOOKMARKLET_VERSION); ?></span>
                </a>
            </div>

            <div class="step">
                <h2>
                    <span class="step-number">2</span>
                    Use the Bookmarklet
                </h2>
                <p>Navigate to a ChatGPT conversation and click the bookmarklet in your bookmarks bar. The tool will:</p>
                <ul style="margin: 15px 0; padding-left: 20px;">
                    <li>Extract the conversation content</li>
                    <li>Remove unnecessary UI elements</li>
                    <li>Prepare a clean export file</li>
                </ul>
            </div>

            <div class="step">
                <h2>
                    <span class="step-number">3</span>
                    Save the Export
                </h2>
                <p>The bookmarklet downloads a self-contained <code>.html</code> file or a plain <code>.md</code> file to your computer.</p>
                <ul style="margin: 15px 0; padding-left: 20px;">
                    <li>Open HTML exports locally in your browser</li>
                    <li>Use Markdown exports in editors, notes apps, or documentation workflows</li>
                </ul>
            </div>

            <div class="warning">
                <h3>Browser Compatibility</h3>
                <p>This bookmarklet works best in Chrome, Firefox, Safari, and Edge.</p>
            </div>
        </div>

        <div class="footer">
            <p>🌘<a href="https://emrahdiril.com">Emrah Diril</a> &copy; 2025-2026. All Rights Reserved.</p>
        </div>
    </div>

    <script>
        // Add some interactive animations
        document.addEventListener('DOMContentLoaded', function() {
            const steps = document.querySelectorAll('.step');
            steps.forEach((step, index) => {
                step.style.animationDelay = `${index * 0.2}s`;
                step.style.opacity = '0';
                step.style.animation = 'slideUp 0.6s ease-out forwards';
            });
        });
    </script>
</body>
</html>
