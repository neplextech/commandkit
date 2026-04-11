// borrowed from https://github.com/vendure-ecommerce/vendure/blob/cfc0dd7c34fd070a15455508f32d37e94589e656/scripts/docs/typescript-docs-renderer.ts
/* eslint-disable no-console */
import fs from 'fs-extra';
import path from 'path';
import { HeritageClause } from 'typescript';

import {
  normalizeForUrlPart,
  escapeIfNeeded,
  normalizeLineEndings,
} from './docgen-utils';

import { generateFrontMatter } from './docgen-utils';
import {
  ClassInfo,
  DeclarationInfo,
  DocsPage,
  EnumInfo,
  FunctionInfo,
  InterfaceInfo,
  MethodParameterInfo,
  ParsedDeclaration,
  TypeAliasInfo,
  TypeMap,
  VariableInfo,
} from './typescript-docgen-types';

const INDENT = '    ';

export class TypescriptDocsRenderer {
  render(
    pages: DocsPage[],
    docsUrl: string,
    outputPath: string,
    typeMap: TypeMap,
  ): number {
    let generatedCount = 0;
    if (!fs.existsSync(outputPath)) {
      fs.ensureDirSync(outputPath);
    }

    for (const page of pages) {
      // Filter out private and internal declarations
      const publicDeclarations = page.declarations.filter(
        (info) => !this.isPrivateOrInternal(info),
      );

      if (publicDeclarations.length === 0) {
        continue; // Skip pages with no public declarations
      }

      // Group declarations by kind for separate directory organization
      const declarationsByKind =
        this.groupDeclarationsByKind(publicDeclarations);

      for (const [kind, declarations] of declarationsByKind.entries()) {
        for (const info of declarations.sort((a, b) => a.weight - b.weight)) {
          let markdown = '';
          markdown += generateFrontMatter(info.title);

          switch (info.kind) {
            case 'interface':
              markdown += this.renderInterfaceOrClass(
                info as InterfaceInfo,
                typeMap,
                docsUrl,
              );
              break;
            case 'typeAlias':
              markdown += this.renderTypeAlias(
                info as TypeAliasInfo,
                typeMap,
                docsUrl,
              );
              break;
            case 'class':
              markdown += this.renderInterfaceOrClass(
                info as ClassInfo,
                typeMap,
                docsUrl,
              );
              break;
            case 'enum':
              markdown += this.renderEnum(info as EnumInfo, typeMap, docsUrl);
              break;
            case 'function':
              markdown += this.renderFunction(
                info as FunctionInfo,
                typeMap,
                docsUrl,
              );
              break;
            case 'variable':
              markdown += this.renderVariable(
                info as VariableInfo,
                typeMap,
                docsUrl,
              );
              break;
            default:
              // This should never happen due to TypeScript's exhaustive checking
              console.warn(`Unknown declaration kind: ${(info as any).kind}`);
              break;
          }

          // Create package and kind-specific directory structure
          const kindDir = this.getKindDirectory(kind);
          const categoryDir = path.join(outputPath, ...page.category, kindDir);
          if (!fs.existsSync(categoryDir)) {
            fs.mkdirsSync(categoryDir);
          }

          // Create index files for each directory level
          const pathParts: string[] = [...page.category];
          for (const subCategory of pathParts) {
            const indexFile = path.join(
              outputPath,
              ...pathParts.slice(0, pathParts.indexOf(subCategory) + 1),
              'index.mdx',
            );
            const exists = fs.existsSync(indexFile);
            const existingContent =
              exists && fs.readFileSync(indexFile).toString();
            const hasActualContent =
              existingContent &&
              existingContent.includes('isDefaultIndex: false');
            if (!exists && !hasActualContent) {
              const indexTitle = subCategory;
              const indexFileContent =
                generateFrontMatter(indexTitle, true) +
                `\n\nimport DocCardList from '@theme/DocCardList';\n\n<DocCardList />`;
              fs.writeFileSync(
                indexFile,
                normalizeLineEndings(indexFileContent),
              );
              generatedCount++;
            }
          }

          // Create kind-specific index file
          const kindIndexFile = path.join(
            outputPath,
            ...page.category,
            kindDir,
            'index.mdx',
          );
          const kindExists = fs.existsSync(kindIndexFile);
          const kindExistingContent =
            kindExists && fs.readFileSync(kindIndexFile).toString();
          const kindHasActualContent =
            kindExistingContent &&
            kindExistingContent.includes('isDefaultIndex: false');
          if (!kindExists && !kindHasActualContent) {
            const kindTitle = this.getKindDisplayName(kind);
            const kindIndexFileContent =
              generateFrontMatter(kindTitle, true) +
              `\n\nimport DocCardList from '@theme/DocCardList';\n\n<DocCardList />`;
            fs.writeFileSync(
              kindIndexFile,
              normalizeLineEndings(kindIndexFileContent),
            );
            generatedCount++;
          }

          // Write the individual declaration file
          const fileName = normalizeForUrlPart(info.title);
          fs.writeFileSync(
            path.join(categoryDir, fileName + '.mdx'),
            normalizeLineEndings(markdown),
          );
          generatedCount++;
        }
      }
    }
    return generatedCount;
  }

  private isPrivateOrInternal(declaration: ParsedDeclaration): boolean {
    // Check if declaration is marked as internal or private
    if (
      declaration.description.includes('@internal') ||
      declaration.description.includes('@private')
    ) {
      return true;
    }

    // Check if declaration name starts with underscore (private by convention)
    if (
      declaration.title.startsWith('_') ||
      declaration.title.startsWith('#')
    ) {
      return true;
    }

    // For classes and interfaces, check if they have private/internal members only
    if (declaration.kind === 'class' || declaration.kind === 'interface') {
      const hasPublicMembers = (
        declaration as ClassInfo | InterfaceInfo
      ).members.some(
        (member) =>
          !member.name.startsWith('_') &&
          !member.name.startsWith('#') &&
          !member.description.includes('@internal') &&
          !member.description.includes('@private'),
      );
      // If it has no public members and is not explicitly documented, consider it internal
      if (!hasPublicMembers && !declaration.description.trim()) {
        return true;
      }
    }

    return false;
  }

  private groupDeclarationsByKind(
    declarations: ParsedDeclaration[],
  ): Map<string, ParsedDeclaration[]> {
    const groups = new Map<string, ParsedDeclaration[]>();

    for (const declaration of declarations) {
      const kind = declaration.kind;
      if (!groups.has(kind)) {
        groups.set(kind, []);
      }
      groups.get(kind)!.push(declaration);
    }

    return groups;
  }

  private getKindDirectory(kind: string): string {
    const kindMapping = {
      interface: 'interfaces',
      typeAlias: 'types',
      class: 'classes',
      enum: 'enums',
      function: 'functions',
      variable: 'variables',
    };
    return kindMapping[kind as keyof typeof kindMapping] || kind;
  }

  private getKindDisplayName(kind: string): string {
    const displayNames = {
      interface: 'Interfaces',
      typeAlias: 'Type Aliases',
      class: 'Classes',
      enum: 'Enums',
      function: 'Functions',
      variable: 'Variables',
    };
    return displayNames[kind as keyof typeof displayNames] || kind;
  }

  /**
   * Render the interface to a markdown string.
   */
  private renderInterfaceOrClass(
    info: InterfaceInfo | ClassInfo,
    knownTypeMap: TypeMap,
    docsUrl: string,
  ): string {
    const { title, weight, category, description, members } = info;
    let output = '';
    output += `\n\n## ${title}\n\n`;
    output += this.renderGenerationInfoShortcode(info);
    output += `${this.renderDescription(description, knownTypeMap, docsUrl)}\n\n`;
    output +=
      info.kind === 'interface'
        ? this.renderInterfaceSignature(info)
        : this.renderClassSignature(info);
    if (info.extendsClause) {
      output += '* Extends: ';
      output += `${this.renderHeritageClause(info.extendsClause, knownTypeMap, docsUrl)}\n`;
    }
    if (info.kind === 'class' && info.implementsClause) {
      output += '* Implements: ';
      output += `${this.renderHeritageClause(info.implementsClause, knownTypeMap, docsUrl)}\n`;
    }
    if (info.members && info.members.length) {
      output += '\n<div className="members-wrapper">\n';
      output += `${this.renderMembers(info, knownTypeMap, docsUrl)}\n`;
      output += '\n\n</div>\n';
    }
    return output;
  }

  /**
   * Render the type alias to a markdown string.
   */
  private renderTypeAlias(
    typeAliasInfo: TypeAliasInfo,
    knownTypeMap: TypeMap,
    docsUrl: string,
  ): string {
    const { title, weight, description, type, fullText } = typeAliasInfo;
    let output = '';
    output += `\n\n## ${title}\n\n`;
    output += this.renderGenerationInfoShortcode(typeAliasInfo);
    output += `${this.renderDescription(description, knownTypeMap, docsUrl)}\n\n`;
    output += this.renderTypeAliasSignature(typeAliasInfo);
    if (typeAliasInfo.members && typeAliasInfo.members.length) {
      output += '\n<div className="members-wrapper">\n';
      output += `${this.renderMembers(typeAliasInfo, knownTypeMap, docsUrl)}\n`;
      output += '\n\n</div>\n';
    }
    return output;
  }

  private renderEnum(
    enumInfo: EnumInfo,
    knownTypeMap: TypeMap,
    docsUrl: string,
  ): string {
    const { title, weight, description, fullText } = enumInfo;
    let output = '';
    output += `\n\n## ${title}\n\n`;
    output += this.renderGenerationInfoShortcode(enumInfo);
    output += `${this.renderDescription(description, knownTypeMap, docsUrl)}\n\n`;
    output += this.renderEnumSignature(enumInfo);
    return output;
  }

  private renderFunction(
    functionInfo: FunctionInfo,
    knownTypeMap: TypeMap,
    docsUrl: string,
  ): string {
    const { title, weight, description, fullText, parameters } = functionInfo;
    let output = '';
    output += `\n\n## ${title}\n\n`;
    output += this.renderGenerationInfoShortcode(functionInfo);
    output += `${this.renderDescription(description, knownTypeMap, docsUrl)}\n\n`;
    output += this.renderFunctionSignature(functionInfo, knownTypeMap);
    if (parameters.length) {
      output += 'Parameters\n\n';
      output += this.renderFunctionParams(parameters, knownTypeMap, docsUrl);
    }
    return output;
  }

  private renderVariable(
    variableInfo: VariableInfo,
    knownTypeMap: TypeMap,
    docsUrl: string,
  ): string {
    const { title, weight, description, fullText } = variableInfo;
    let output = '';
    output += `\n\n## ${title}\n\n`;
    output += this.renderGenerationInfoShortcode(variableInfo);
    output += `${this.renderDescription(description, knownTypeMap, docsUrl)}\n\n`;
    return output;
  }

  /**
   * Generates a markdown code block string for the interface signature.
   */
  private renderInterfaceSignature(interfaceInfo: InterfaceInfo): string {
    const { fullText, members } = interfaceInfo;
    let output = '';
    output += '```ts title="Signature"\n';
    output += `interface ${normalizeLineEndings(fullText)} `;
    if (interfaceInfo.extendsClause) {
      output +=
        normalizeLineEndings(interfaceInfo.extendsClause.getText()) + ' ';
    }
    output += '{\n';
    output += members
      .map((member) => `${INDENT}${normalizeLineEndings(member.fullText)}`)
      .join('\n');
    output += '\n}\n';
    output += '```\n';

    return output;
  }

  private renderClassSignature(classInfo: ClassInfo): string {
    const { fullText, members } = classInfo;
    let output = '';
    output += '```ts title="Signature"\n';
    output += `class ${normalizeLineEndings(fullText)} `;
    if (classInfo.extendsClause) {
      output += normalizeLineEndings(classInfo.extendsClause.getText()) + ' ';
    }
    if (classInfo.implementsClause) {
      output +=
        normalizeLineEndings(classInfo.implementsClause.getText()) + ' ';
    }
    output += '{\n';
    const renderModifiers = (modifiers: string[]) =>
      modifiers.length ? modifiers.join(' ') + ' ' : '';
    output += members
      .map((member) => {
        if (member.kind === 'method') {
          const args = member.parameters
            .map((p) => this.renderParameter(p, p.type))
            .join(', ');
          if (member.fullText === 'constructor') {
            return `${INDENT}constructor(${args})`;
          } else {
            return `${INDENT}${normalizeLineEndings(member.fullText)}(${args}) => ${this.normalizeTypeText(member.type)};`;
          }
        } else {
          return `${INDENT}${normalizeLineEndings(member.fullText)}`;
        }
      })
      .join('\n');
    output += '\n}\n';
    output += '```\n';

    return output;
  }

  private renderTypeAliasSignature(typeAliasInfo: TypeAliasInfo): string {
    const { fullText, members, type } = typeAliasInfo;
    let output = '';
    output += '```ts title="Signature"\n';
    output += `type ${normalizeLineEndings(fullText)} = `;
    if (members) {
      output += '{\n';
      output += members
        .map((member) => `${INDENT}${normalizeLineEndings(member.fullText)}`)
        .join('\n');
      output += '\n}\n';
    } else {
      output += normalizeLineEndings(type.getText()) + '\n';
    }
    output += '```\n';
    return output;
  }

  private renderEnumSignature(enumInfo: EnumInfo): string {
    const { fullText, members } = enumInfo;
    let output = '';
    output += '```ts title="Signature"\n';
    output += `enum ${normalizeLineEndings(fullText)} `;
    if (members) {
      output += '{\n';
      output += members
        .map((member) => {
          let line = member.description
            ? `${INDENT}// ${member.description}\n`
            : '';
          line += `${INDENT}${normalizeLineEndings(member.fullText)}`;
          return line;
        })
        .join('\n');
      output += '\n}\n';
    }
    output += '```\n';
    return output;
  }

  private renderFunctionSignature(
    functionInfo: FunctionInfo,
    knownTypeMap: TypeMap,
  ): string {
    const { fullText, parameters, type } = functionInfo;
    const args = parameters
      .map((p) => this.renderParameter(p, p.type))
      .join(', ');
    let output = '';
    output += '```ts title="Signature"\n';
    output += `function ${normalizeLineEndings(fullText)}(${args}): ${
      type ? normalizeLineEndings(type.getText()) : 'void'
    }\n`;
    output += '```\n';
    return output;
  }

  private renderFunctionParams(
    params: MethodParameterInfo[],
    knownTypeMap: TypeMap,
    docsUrl: string,
  ): string {
    let output = '';
    for (const param of params) {
      const type = this.renderType(param.type, knownTypeMap, docsUrl);
      output += `### ${escapeIfNeeded(param.name)}\n\n`;
      output += `<MemberInfo kind="parameter" type={\`${type}\`} />\n\n`;
    }
    return output;
  }

  private renderMembers(
    info: InterfaceInfo | ClassInfo | TypeAliasInfo | EnumInfo,
    knownTypeMap: TypeMap,
    docsUrl: string,
  ): string {
    const { members, title } = info;
    let output = '';
    for (const member of members || []) {
      let defaultParam = '';
      let sinceParam = '';
      let experimentalParam = '';
      let type = '';
      if (member.kind === 'property') {
        type = this.renderType(member.type, knownTypeMap, docsUrl);
        defaultParam = member.defaultValue
          ? `default={\`${escapeIfNeeded(this.renderType(member.defaultValue, knownTypeMap, docsUrl))}\`} `
          : '';
      } else {
        const args = member.parameters
          .map((p) =>
            this.renderParameter(
              p,
              this.renderType(p.type, knownTypeMap, docsUrl),
            ),
          )
          .join(', ');
        if (member.fullText === 'constructor') {
          type = `(${args}) => ${title}`;
        } else {
          type = `(${args}) => ${this.renderType(member.type, knownTypeMap, docsUrl)}`;
        }
      }
      if (member.since) {
        sinceParam = `since="${member.since}" `;
      }
      if (member.experimental) {
        experimentalParam = 'experimental="true"';
      }
      output += `\n### ${escapeIfNeeded(member.name)}\n\n`;
      output += `<MemberInfo kind="${[member.kind].join(
        ' ',
      )}" type={\`${type}\`} ${defaultParam} ${sinceParam}${experimentalParam} />\n\n`;
      output += this.renderDescription(
        member.description,
        knownTypeMap,
        docsUrl,
      );
    }
    return output;
  }

  private renderHeritageClause(
    clause: HeritageClause,
    knownTypeMap: TypeMap,
    docsUrl: string,
  ) {
    return (
      clause.types
        .map(
          (t) =>
            `<code>${this.renderType(t.getText(), knownTypeMap, docsUrl)}</code>`,
        )
        .join(', ') + '\n\n'
    );
  }

  private renderParameter(p: MethodParameterInfo, typeString: string): string {
    return `${p.name}${p.optional ? '?' : ''}: ${this.normalizeTypeText(
      typeString,
    )}${p.initializer ? ` = ${normalizeLineEndings(p.initializer)}` : ''}`;
  }

  private renderGenerationInfoShortcode(info: DeclarationInfo): string {
    const sourceFile = info.sourceFile.replace(/^\.\.\//, '');
    let sinceData = '';
    if (info.since) {
      sinceData = ` since="${info.since}"`;
    }
    let experimental = '';
    if (info.experimental) {
      experimental = ' experimental="true"';
    }
    return `<GenerationInfo sourceFile="${sourceFile}" sourceLine="${info.sourceLine}" packageName="${info.packageName}"${sinceData}${experimental} />\n\n`;
  }

  /**
   * This function takes a string representing a type (e.g. "Array<ShippingMethod>") and turns
   * and known types (e.g. "ShippingMethod") into hyperlinks.
   */
  private renderType(
    type: string,
    knownTypeMap: TypeMap,
    docsUrl: string,
  ): string {
    let typeText = this.normalizeTypeText(type)
      // encode HTML entities
      .replace(/[\u00A0-\u9999<>\&]/gim, (i) => '&#' + i.charCodeAt(0) + ';')
      // remove newlines
      .replace(/\n/g, ' ');

    for (const [key, val] of knownTypeMap) {
      const re = new RegExp(`(?!<a[^>]*>)\\b${key}\\b(?![^<]*<\/a>)`, 'g');
      const strippedIndex = val.replace(/\/_index$/, '');
      typeText = typeText.replace(
        re,
        `<a href='${docsUrl}/${strippedIndex}'>${key}</a>`,
      );
    }
    return typeText;
  }

  private normalizeTypeText(type: string): string {
    return normalizeLineEndings(type).trim();
  }

  /**
   * Replaces any `{@link Foo}` references in the description with hyperlinks.
   */
  private renderDescription(
    description: string,
    knownTypeMap: TypeMap,
    docsUrl: string,
  ): string {
    for (const [key, val] of knownTypeMap) {
      const re = new RegExp(`{@link\\s*${key}}`, 'g');
      description = description.replace(
        re,
        `<a href='${docsUrl}/${val}'>${key}</a>`,
      );
    }
    return description;
  }
}
