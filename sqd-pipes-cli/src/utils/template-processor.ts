import fs from 'fs-extra';
import path from 'path';

export interface TemplateVariables {
  [key: string]: string;
}

export async function processTemplate(
  templatePath: string,
  outputPath: string,
  variables: TemplateVariables
): Promise<void> {
  let content = await fs.readFile(templatePath, 'utf8');
  
  // Replace template variables like {{projectName}}
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    content = content.replace(regex, value);
  }
  
  await fs.writeFile(outputPath, content);
}

export async function copyTemplateDirectory(
  templateDir: string,
  targetDir: string,
  variables: TemplateVariables
): Promise<void> {
  const entries = await fs.readdir(templateDir);
  
  for (const entry of entries) {
    const templatePath = path.join(templateDir, entry);
    const stat = await fs.stat(templatePath);
    
    if (stat.isDirectory()) {
      const targetSubDir = path.join(targetDir, entry);
      await fs.ensureDir(targetSubDir);
      await copyTemplateDirectory(templatePath, targetSubDir, variables);
    } else {
      let targetPath = path.join(targetDir, entry);
      
      // Remove .template extension if it exists
      if (entry.endsWith('.template')) {
        targetPath = path.join(targetDir, entry.replace('.template', ''));
      }
      
      if (entry.endsWith('.template') || entry.includes('{{')) {
        // Process as template
        await processTemplate(templatePath, targetPath, variables);
      } else {
        // Copy as-is
        await fs.copy(templatePath, targetPath);
      }
    }
  }
}
