import fs from "fs";
import path from "path";

// Workaround for __dirname in ES Modules
const __dirname = path.dirname(new URL(import.meta.url).pathname);

export const parseTemplate = (templateName: string, placeholders: { [key: string]: string; }): string => {
    const templatePath = path.join(__dirname, '../email-templates', `${templateName}.html`);
    let template = fs.readFileSync(templatePath, 'utf-8');


    // Replace placeholders in the template
    Object.keys(placeholders).forEach((key) => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        template = template.replace(regex, placeholders[key]);
    });

    return template;
};
