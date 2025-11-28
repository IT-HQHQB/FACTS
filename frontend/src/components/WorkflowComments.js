import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Button, Card } from './ui';

const WorkflowComments = ({ caseId, workflowStep }) => {
  const { user } = useAuth();
  const [newComment, setNewComment] = useState('');
  const queryClient = useQueryClient();

  // Fetch existing comments
  const { data: commentsData, isLoading: commentsLoading } = useQuery(
    ['workflow-comments', caseId, workflowStep],
    () => axios.get(`/api/cases/${caseId}/workflow-comments/${workflowStep}`).then(res => res.data),
    {
      enabled: !!caseId && !!workflowStep,
      staleTime: 30 * 1000, // 30 seconds
    }
  );

  // Add comment mutation
  const addCommentMutation = useMutation(
    ({ comment }) => 
      axios.post(`/api/cases/${caseId}/workflow-comments`, { 
        comment, 
        comment_type: 'general',
        workflow_step: workflowStep 
      }),
    {
      onSuccess: () => {
        setNewComment('');
        // Invalidate and refetch comments
        queryClient.invalidateQueries(['workflow-comments', caseId, workflowStep]);
      },
    }
  );

  const handleAddComment = () => {
    if (newComment.trim()) {
      addCommentMutation.mutate({
        comment: newComment.trim()
      });
    }
  };


  const comments = commentsData?.comments || [];

  return (
    <Card className="mt-4">
      <Card.Header>
        <h4 className="text-sm font-medium text-gray-900">Comments for {workflowStep.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</h4>
      </Card.Header>
      <Card.Content>
        <div className="space-y-4">
          {/* Existing Comments */}
          {commentsLoading ? (
            <div className="text-center py-4">
              <div className="text-sm text-gray-500">Loading comments...</div>
            </div>
          ) : comments.length > 0 ? (
            <div className="space-y-3">
              <h5 className="text-sm font-medium text-gray-700">Previous Comments:</h5>
              {comments.map((comment) => (
                <div key={comment.id} className="border-l-4 border-blue-200 pl-4 py-2 bg-gray-50 rounded-r">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="text-sm text-gray-800">{comment.comment}</p>
                      <div className="mt-1 text-xs text-gray-500">
                        <span className="font-medium">{comment.full_name}</span>
                        <span className="mx-2">•</span>
                        <span>{new Date(comment.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4">
              <div className="text-sm text-gray-500">No comments yet. Be the first to add one!</div>
            </div>
          )}

          {/* Add Comment Form */}
          <div className="border rounded-lg p-3 bg-gray-50">
            <div className="space-y-3">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add your comment for this workflow step..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                rows={3}
              />
              <Button
                onClick={handleAddComment}
                disabled={!newComment.trim() || addCommentMutation.isLoading}
                loading={addCommentMutation.isLoading}
                size="sm"
                variant="primary"
              >
                Add Comment
              </Button>
            </div>
          </div>

        </div>
      </Card.Content>
    </Card>
  );
};

export default WorkflowComments;
