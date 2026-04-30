import { useState } from 'react';

interface TemplateEditorProps {
  initialContent?: string;
  onSave: (content: string) => Promise<void>;
}

export default function TemplateEditor({ initialContent = '', onSave }: TemplateEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(content);
      alert('Template saved successfully');
    } catch (err) {
      console.error('Save failed:', err);
      alert('Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const insertVariable = (variable: string) => {
    const textarea = document.getElementById('template-content') as HTMLTextAreaElement;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newContent = content.substring(0, start) + `{{${variable}}}` + content.substring(end);
    setContent(newContent);
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Template Editor</h2>

      <div className="mb-4">
        <label className="block text-sm font-semibold text-gray-900 mb-2">Available Variables</label>
        <div className="flex flex-wrap gap-2">
          {['client_name', 'account_username', 'violation_type', 'appeal_deadline', 'case_id'].map((variable) => (
            <button
              key={variable}
              onClick={() => insertVariable(variable)}
              className="bg-blue-100 hover:bg-blue-200 text-blue-800 text-sm font-semibold px-3 py-1 rounded"
            >
              {variable}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-semibold text-gray-900 mb-2">Template Content</label>
        <textarea
          id="template-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={10}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
          placeholder="Enter template content. Use {{variable}} for dynamic content."
        />
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition"
      >
        {saving ? 'Saving...' : 'Save Template'}
      </button>
    </div>
  );
}

interface DeadlineAlertRowProps {
  caseId: number;
  accountUsername: string;
  deadline: string;
  daysRemaining: number;
  onAcknowledge: (caseId: number) => Promise<void>;
}

export function DeadlineAlertRow({
  caseId,
  accountUsername,
  deadline,
  daysRemaining,
  onAcknowledge,
}: DeadlineAlertRowProps) {
  const [acknowledging, setAcknowledging] = useState(false);

  const handleAcknowledge = async () => {
    setAcknowledging(true);
    try {
      await onAcknowledge(caseId);
    } finally {
      setAcknowledging(false);
    }
  };

  const isUrgent = daysRemaining <= 3;

  return (
    <tr className={isUrgent ? 'bg-red-50' : ''}>
      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{accountUsername}</td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{deadline}</td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
          isUrgent ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
        }`}>
          {daysRemaining} days
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm">
        <button
          onClick={handleAcknowledge}
          disabled={acknowledging}
          className="text-blue-600 hover:text-blue-900 font-semibold disabled:opacity-50"
        >
          {acknowledging ? 'Acknowledging...' : 'Acknowledge'}
        </button>
      </td>
    </tr>
  );
}

interface BroadcastComposerProps {
  onSend: (title: string, message: string, segment: string) => Promise<void>;
}

export function BroadcastComposer({ onSend }: BroadcastComposerProps) {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [segment, setSegment] = useState('all');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    setSending(true);
    try {
      await onSend(title, message, segment);
      setTitle('');
      setMessage('');
      setSegment('all');
      alert('Broadcast sent successfully');
    } catch (err) {
      console.error('Send failed:', err);
      alert('Failed to send broadcast');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Compose Broadcast</h2>

      <div className="mb-4">
        <label className="block text-sm font-semibold text-gray-900 mb-2">Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="mb-4">
        <label className="block text-sm font-semibold text-gray-900 mb-2">Message</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="mb-4">
        <label className="block text-sm font-semibold text-gray-900 mb-2">Target Segment</label>
        <select
          value={segment}
          onChange={(e) => setSegment(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Clients</option>
          <option value="active">Active Clients</option>
          <option value="high_compliance">High Compliance</option>
          <option value="low_compliance">Low Compliance</option>
        </select>
      </div>

      <button
        onClick={handleSend}
        disabled={sending || !title.trim() || !message.trim()}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition"
      >
        {sending ? 'Sending...' : 'Send Broadcast'}
      </button>
    </div>
  );
}
