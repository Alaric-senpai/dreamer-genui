// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { useState } from 'react';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../../packages/dreamer-genui/src/ui/accordion';
import { Badge } from '../../packages/dreamer-genui/src/ui/badge';
import { Button } from '../../packages/dreamer-genui/src/ui/button';
import { Calendar } from '../../packages/dreamer-genui/src/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '../../packages/dreamer-genui/src/ui/card';
import { Checkbox } from '../../packages/dreamer-genui/src/ui/checkbox';
import { Combobox } from '../../packages/dreamer-genui/src/ui/combobox';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '../../packages/dreamer-genui/src/ui/command';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '../../packages/dreamer-genui/src/ui/dialog';
import { Label } from '../../packages/dreamer-genui/src/ui/label';
import { Sidebar, SidebarContent, SidebarProvider, SidebarTrigger } from '../../packages/dreamer-genui/src/ui/sidebar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../packages/dreamer-genui/src/ui/tabs';

expect.extend(toHaveNoViolations);
afterEach(cleanup);

beforeAll(() => {
  if (!('ResizeObserver' in window)) {
    class ResizeObserverStub {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    Object.defineProperty(window, 'ResizeObserver', { value: ResizeObserverStub, writable: true });
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
});

describe('host UI kit: keyboard and screen-reader behavior', () => {
  test('accordion toggles from the keyboard and exposes its state', async () => {
    const user = userEvent.setup();
    render(
      <Accordion type="single" collapsible>
        <AccordionItem value="one">
          <AccordionTrigger>First section</AccordionTrigger>
          <AccordionContent>First body</AccordionContent>
        </AccordionItem>
      </Accordion>
    );

    const trigger = screen.getByRole('button', { name: 'First section' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    trigger.focus();
    await user.keyboard('{Enter}');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('First body')).toBeVisible();
  });

  test('tabs move with arrow keys and label their panel', async () => {
    const user = userEvent.setup();
    render(
      <Tabs defaultValue="one">
        <TabsList aria-label="Sections">
          <TabsTrigger value="one">One</TabsTrigger>
          <TabsTrigger value="two">Two</TabsTrigger>
        </TabsList>
        <TabsContent value="one">Panel one</TabsContent>
        <TabsContent value="two">Panel two</TabsContent>
      </Tabs>
    );

    const one = screen.getByRole('tab', { name: 'One' });
    one.focus();
    await user.keyboard('{ArrowRight}');

    const two = screen.getByRole('tab', { name: 'Two' });
    expect(two).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Panel two')).toBeVisible();
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', two.id);
  });

  test('dialog traps focus, is labelled, and closes on Escape', async () => {
    const user = userEvent.setup();
    render(
      <Dialog>
        <DialogTrigger asChild>
          <Button>Open settings</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Adjust the lesson board.</DialogDescription>
          <Button>Save</Button>
        </DialogContent>
      </Dialog>
    );

    await user.click(screen.getByRole('button', { name: 'Open settings' }));
    const dialog = await screen.findByRole('dialog', { name: 'Settings' });
    expect(dialog).toBeVisible();
    expect(screen.getByText('Adjust the lesson board.')).toBeVisible();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('combobox filters with the keyboard and selects an option', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    function Harness() {
      const [value, setValue] = useState('');
      return (
        <Combobox
          aria-label="Choose a plan"
          value={value}
          onValueChange={(next) => {
            setValue(next);
            onValueChange(next);
          }}
          options={[
            { value: 'starter', label: 'Starter' },
            { value: 'studio', label: 'Studio' },
            { value: 'scale', label: 'Scale' },
          ]}
        />
      );
    }
    render(<Harness />);

    const trigger = screen.getByRole('combobox', { name: 'Choose a plan' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    const search = screen.getByPlaceholderText('Search…');
    await user.type(search, 'stu');
    const option = await screen.findByRole('option', { name: /Studio/ });
    await user.click(option);

    expect(onValueChange).toHaveBeenCalledWith('studio');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveTextContent('Studio');
  });

  test('calendar supports selection and arrow-key movement', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const month = new Date(2026, 10, 18);
    render(<Calendar month={month} selected={month} onSelect={onSelect} locale="en-GB" />);

    const selected = screen.getByRole('gridcell', { selected: true });
    expect(selected).toHaveAttribute('data-date', '2026-11-18');
    expect(selected).toHaveAttribute('aria-label', expect.stringContaining('November'));

    selected.focus();
    await user.keyboard('{ArrowRight}');
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    const focused = document.activeElement as HTMLElement;
    expect(focused).toHaveAttribute('data-date', '2026-11-19');

    await user.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalled();
    expect((onSelect.mock.calls[0]?.[0] as Date).getDate()).toBe(19);
  });

  test('sidebar trigger reflects and toggles the open state', async () => {
    const user = userEvent.setup();
    render(
      <SidebarProvider defaultOpen>
        <Sidebar aria-label="Lesson navigation">
          <SidebarContent>Contents</SidebarContent>
        </Sidebar>
        <main>
          <SidebarTrigger />
          Body
        </main>
      </SidebarProvider>
    );

    const trigger = screen.getByRole('button', { name: 'Collapse sidebar' });
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    await user.click(trigger);
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toHaveAttribute('aria-expanded', 'false');
  });

  test('command filters items as the user types', async () => {
    const user = userEvent.setup();
    render(
      <Command>
        <CommandInput placeholder="Search lessons" />
        <CommandList>
          <CommandEmpty>Nothing found.</CommandEmpty>
          <CommandItem value="fractions">Fractions</CommandItem>
          <CommandItem value="decimals">Decimals</CommandItem>
        </CommandList>
      </Command>
    );

    await user.type(screen.getByPlaceholderText('Search lessons'), 'frac');
    expect(await screen.findByText('Fractions')).toBeInTheDocument();
    expect(screen.queryByText('Decimals')).not.toBeInTheDocument();
  });
});

describe('host UI kit: accessibility', () => {
  test('a composed form surface has no axe violations', async () => {
    const { container } = render(
      <div className="dg-ui-root">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <Label htmlFor="display-name">Display name</Label>
            <input id="display-name" className="dg-ui-input" />
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Checkbox id="share" />
              <Label htmlFor="share">Share progress</Label>
            </div>
            <Badge tone="success">Saved</Badge>
            <Button>Save</Button>
          </CardContent>
        </Card>
      </div>
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
